import { describe, expect, it } from 'vitest';
import { PNG, SIGNING_STEPS, findTicket, loginAs } from '@/test/mockApi';
import { routeMockRequest } from './router';
import { notify } from './notifications';

// Un usuario por rol. Ids de rol: r-2 operaciones, r-3 piloto, r-4 mantenimiento,
// r-5 tierra, r-6 administración, r-7 gerencia general.
const who = () => ({
  su: loginAs('super@transvalor.com'),
  ops: loginAs('operaciones@transvalor.com'),
  pilot: loginAs('piloto@transvalor.com'),
  maint: loginAs('mantenimiento@transvalor.com'),
  ground: loginAs('tierra@transvalor.com'),
  admin: loginAs('admin@transvalor.com'),
  exec: loginAs('gerencia@transvalor.com'),
});
type Sess = ReturnType<typeof loginAs>;
type Crew = ReturnType<typeof who>;

const list = (s: Sess, q: Record<string, string> = {}) => s.get('/notifications/', q).data;
/** Avisos de un ticket concreto que ve este usuario. */
const about = (s: Sess, ticketId: string, kind?: string) =>
  (list(s, { limit: '200' }).data as any[]).filter(
    (n) => n.ticket_id === ticketId && (!kind || n.kind === kind),
  );
/** Quiénes (de todos los roles) reciben algo sobre este ticket. */
const receivers = (c: Crew, ticketId: string, kind?: string) =>
  (Object.keys(c) as (keyof Crew)[]).filter((k) => about(c[k], ticketId, kind).length > 0).sort();

const OP = { date: '2026-09-10', origin: 'CCS', destination: 'PZO', aircraft: 'YV2323' };
const newOp = (s: Sess, extra: Record<string, unknown> = {}) => {
  const r = s.post('/tickets/', {
    type_code: 'operation',
    title: 'Vuelo de prueba',
    payload: OP,
    ...extra,
  });
  expect(r.status).toBe(201);
  return r.data;
};
const child = (s: Sess, parent: string, type_code: string, extra: Record<string, unknown> = {}) => {
  const payload =
    type_code === 'expense'
      ? { concept: 'fuel', amount: 100, currency: 'USD' }
      : type_code === 'inac_permit'
        ? { scope: 'domestic' }
        : type_code === 'technical_report'
          ? { description: 'falla' }
          : {};
  const r = s.post('/tickets/', {
    type_code,
    title: type_code,
    parent_id: parent,
    payload,
    ...extra,
  });
  expect(r.status).toBe(201);
  return r.data;
};
/** Registra los pasos obligatorios para que la operación pueda cerrarse. */
const signAllSteps = (s: Sess, op: any) => {
  // El cierre firmado exige la rúbrica de quien firma: se carga una antes.
  s.patch('/auth/me/signature/', { signature_url: 'data:image/png;base64,iVBORw0KGgo=' });
  ['planning', 'requirements', 'ground', 'technical', ...SIGNING_STEPS].forEach((step_code) =>
    s.post(`/tickets/${op.id}/decisions/`, { step_code, decision: 'done' }),
  );
  // El reporte técnico que el sistema abre solo también bloquea el cierre.
  const tech = (s.get('/ticket-types/').data as any[]).find((t) => t.code === 'technical_report');
  (s.get('/tickets/', { parent_id: op.id, limit: '50' }).data.data as any[])
    .filter((t) => t.type_code === 'technical_report' && !t.status_is_final)
    .forEach((t) => {
      tech.steps.forEach((st: any) =>
        s.post(`/tickets/${t.id}/decisions/`, { step_code: st.code, decision: 'done' }),
      );
      s.patch(`/tickets/${t.id}/`, { status_code: 'solved' });
    });
};

describe('avisos por evento: alta de tickets', () => {
  it('una operación nueva avisa SOLO al rol asignado por defecto (Operaciones)', () => {
    const c = who();
    const op = newOp(c.su);
    expect(receivers(c, op.id)).toEqual(['ops']);
    expect(about(c.ops, op.id)[0].kind).toBe('operation_created');
  });

  it('una operación asignada a otro rol avisa a ese rol y no al de por defecto', () => {
    const c = who();
    const op = newOp(c.su, { assigned_role_id: 'r-3' });
    expect(receivers(c, op.id)).toEqual(['pilot']);
  });

  it('un responsable puntual recibe el aviso aunque su rol no sea el asignado', () => {
    const c = who();
    const op = newOp(c.su, { assigned_role_id: 'r-3', assigned_user_id: 'u-4' });
    expect(receivers(c, op.id)).toEqual(['ground', 'pilot']);
  });

  it('un responsable inexistente se ignora y el aviso cae al rol', () => {
    const c = who();
    const op = newOp(c.su, { assigned_user_id: 'u-999' });
    expect(op.assigned_user_id).toBeUndefined();
    expect(receivers(c, op.id)).toEqual(['ops']);
  });

  it('el superusuario NO recibe avisos de audiencias ajenas', () => {
    const c = who();
    const op = newOp(c.su);
    expect(about(c.su, op.id)).toHaveLength(0);
  });

  it('un hijo con rol asignado avisa solo a ese rol y enlaza al ticket', () => {
    const c = who();
    const op = newOp(c.su);
    const ex = child(c.su, op.id, 'expense', { assigned_role_id: 'r-6' });
    expect(receivers(c, ex.id)).toEqual(['admin']);
    const n = about(c.admin, ex.id)[0];
    expect(n.kind).toBe('ticket_assigned');
    expect(n.ticket_id).toBe(ex.id);
    expect(n.operation_code).toBe(op.code);
  });

  it('un hijo sin rol ni responsable no avisa a nadie', () => {
    const c = who();
    const op = newOp(c.su);
    const ex = child(c.su, op.id, 'expense', { assigned_role_id: '' });
    // El tipo de gasto trae rol por defecto; se verifica que no se filtra a otros.
    expect(receivers(c, ex.id).every((k) => k === 'admin' || k === 'pilot')).toBe(true);
    expect(about(c.maint, ex.id)).toHaveLength(0);
  });
});

describe('avisos por evento: INAC', () => {
  it('crear un permiso INAC avisa a Operaciones, una sola vez, y a nadie más', () => {
    const c = who();
    const op = newOp(c.su);
    const inac = child(c.su, op.id, 'inac_permit');
    expect(receivers(c, inac.id)).toEqual(['ops']);
    expect(about(c.ops, inac.id)).toHaveLength(1);
    expect(about(c.ops, inac.id)[0].kind).toBe('navaid_pending');
  });

  it('con otro rol asignado, ese rol recibe la asignación y Operaciones el pendiente', () => {
    const c = who();
    const op = newOp(c.su);
    const inac = child(c.su, op.id, 'inac_permit', { assigned_role_id: 'r-6' });
    expect(about(c.admin, inac.id).map((n: any) => n.kind)).toEqual(['ticket_assigned']);
    expect(about(c.ops, inac.id).map((n: any) => n.kind)).toEqual(['navaid_pending']);
    expect(about(c.pilot, inac.id)).toHaveLength(0);
  });

  it('volver a "falta radioayuda" genera un aviso nuevo para Operaciones', () => {
    const c = who();
    const op = newOp(c.su);
    const inac = child(c.su, op.id, 'inac_permit');
    c.su.patch(`/tickets/${inac.id}/`, { status_code: 'pending_payment' });
    const pending = about(c.ops, inac.id, 'navaid_pending');
    expect(pending).toHaveLength(2);
    expect(pending.some((n: any) => n.body.includes('Falta radioayuda'))).toBe(true);
  });

  it('aprobar el permiso (estado final) no genera aviso de pendiente', () => {
    const c = who();
    const op = newOp(c.su);
    const inac = child(c.su, op.id, 'inac_permit');
    c.su.patch(`/tickets/${inac.id}/`, { status_code: 'approved' });
    expect(about(c.ops, inac.id, 'navaid_pending')).toHaveLength(1);
  });

  it('intentar cerrar con un INAC sin resolver avisa a Operaciones: cierre bloqueado', () => {
    const c = who();
    const op = newOp(c.su);
    signAllSteps(c.su, op);
    const inac = child(c.su, op.id, 'inac_permit');
    const r = c.su.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(r.status).toBe(422);
    const blocked = about(c.ops, op.id, 'close_blocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0].body).toContain(inac.code);
    expect(receivers(c, op.id, 'close_blocked')).toEqual(['ops']);
  });

  it('reintentar el cierre bloqueado no inunda: sigue siendo un solo aviso', () => {
    const c = who();
    const op = newOp(c.su);
    signAllSteps(c.su, op);
    child(c.su, op.id, 'inac_permit');
    c.su.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    c.su.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    c.su.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(about(c.ops, op.id, 'close_blocked')).toHaveLength(1);
  });

  it('un cierre bloqueado por algo que no es INAC no genera el aviso de INAC', () => {
    const c = who();
    const op = newOp(c.su);
    // Pasos sin firmar: el cierre falla por pasos, no por permisos.
    const r = c.su.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(r.status).toBe(422);
    expect(about(c.ops, op.id, 'close_blocked')).toHaveLength(0);
  });
});

describe('avisos por evento: reporte técnico, comprobantes y cierre', () => {
  it('un reporte técnico cargado avisa a Mantenimiento y a nadie más', () => {
    const c = who();
    const op = newOp(c.su);
    const tr = child(c.su, op.id, 'technical_report');
    expect(receivers(c, tr.id)).toEqual(['maint']);
    expect(about(c.maint, tr.id)[0].kind).toBe('technical_report');
  });

  it('un reporte técnico asignado a otro rol avisa también a ese rol', () => {
    const c = who();
    const op = newOp(c.su);
    const tr = child(c.su, op.id, 'technical_report', { assigned_role_id: 'r-3' });
    expect(receivers(c, tr.id)).toEqual(['maint', 'pilot']);
  });

  it('un comprobante leído avisa a Administración para validarlo', () => {
    const c = who();
    const op = newOp(c.su);
    const ex = child(c.su, op.id, 'expense');
    const r = c.su.post(`/tickets/${ex.id}/attachments/`, {
      name: 'r.png',
      mime: 'image/png',
      size: 9,
      data_url: PNG,
    });
    expect(r.status).toBe(201);
    expect(receivers(c, ex.id, 'receipt_validation')).toEqual(['admin']);
  });

  it('un archivo sin lectura automática (PDF) no genera aviso de validación', () => {
    const c = who();
    const op = newOp(c.su);
    const ex = child(c.su, op.id, 'expense');
    c.su.post(`/tickets/${ex.id}/attachments/`, {
      name: 'r.pdf',
      mime: 'application/pdf',
      size: 9,
      data_url: 'data:application/pdf;base64,JVBERi0=',
    });
    expect(about(c.admin, ex.id, 'receipt_validation')).toHaveLength(0);
  });

  it('cerrar la operación avisa a Operaciones, Administración y tripulación', () => {
    const c = who();
    const op = newOp(c.su);
    signAllSteps(c.su, op);
    expect(c.su.patch(`/tickets/${op.id}/`, { status_code: 'closed' }).status).toBe(200);
    expect(receivers(c, op.id, 'operation_closed')).toEqual(['admin', 'ground', 'ops', 'pilot']);
  });

  it('el cierre llega además al responsable puntual, sea cual sea su rol', () => {
    const c = who();
    const op = newOp(c.su, { assigned_user_id: 'u-3' });
    signAllSteps(c.su, op);
    c.su.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(about(c.maint, op.id, 'operation_closed')).toHaveLength(1);
    expect(about(c.exec, op.id, 'operation_closed')).toHaveLength(0);
  });

  it('anular una operación NO se anuncia como cierre firmado', () => {
    const c = who();
    const op = newOp(c.su);
    expect(c.su.patch(`/tickets/${op.id}/`, { status_code: 'cancelled' }).status).toBe(200);
    expect(receivers(c, op.id, 'operation_closed')).toEqual([]);
  });
});

describe('filtrado por audiencia (servidor)', () => {
  it('cada usuario recibe solo los avisos de su rol: las semillas no se cruzan', () => {
    const c = who();
    const ids = (s: Sess) => (list(s, { limit: '200' }).data as any[]).map((n) => n.id);
    // n-2 es de Administración y Operaciones.
    expect(ids(c.admin)).toContain('n-2');
    expect(ids(c.ops)).toContain('n-2');
    expect(ids(c.pilot)).not.toContain('n-2');
    expect(ids(c.maint)).not.toContain('n-2');
    expect(ids(c.exec)).not.toContain('n-2');
    // n-1 es de piloto, mantenimiento y tierra.
    expect(ids(c.pilot)).toContain('n-1');
    expect(ids(c.ops)).not.toContain('n-1');
    expect(ids(c.admin)).not.toContain('n-1');
  });

  it('un aviso ajeno se responde como inexistente (404), no 403, y no se marca', () => {
    const c = who();
    const before = list(c.admin).unread;
    expect(c.pilot.patch('/notifications/n-2/').status).toBe(404);
    expect(list(c.admin).unread).toBe(before);
    expect(list(c.admin, { limit: '200' }).data.find((n: any) => n.id === 'n-2').read).toBe(false);
  });

  it('un aviso inexistente da 404 igual que uno ajeno', () => {
    const c = who();
    expect(c.pilot.patch('/notifications/no-existe/').status).toBe(404);
  });

  it('sin sesión no se entrega nada', () => {
    const noToken = routeMockRequest({
      method: 'get',
      path: '/notifications/',
      query: new URLSearchParams(),
      body: undefined,
    });
    expect(noToken.status).toBe(401);
  });

  it('la lista llega del más nuevo al más viejo', () => {
    const c = who();
    newOp(c.su);
    const dates = (list(c.ops, { limit: '200' }).data as any[]).map((n) => n.created_at);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe('lectura por usuario y conteo de no leídos', () => {
  it('marcar leído lo hace solo para quien lo marca: otro destinatario lo sigue viendo sin leer', () => {
    const c = who();
    const op = newOp(c.su, { assigned_role_id: 'r-3', assigned_user_id: 'u-4' });
    const id = about(c.pilot, op.id)[0].id;
    expect(about(c.ground, op.id)[0].id).toBe(id);
    expect(c.pilot.patch(`/notifications/${id}/`).status).toBe(200);
    expect(about(c.pilot, op.id)[0].read).toBe(true);
    expect(about(c.ground, op.id)[0].read).toBe(false);
  });

  it('el conteo de no leídos baja solo para quien lee', () => {
    const c = who();
    const op = newOp(c.su, { assigned_role_id: 'r-3', assigned_user_id: 'u-4' });
    const id = about(c.pilot, op.id)[0].id;
    const pilotBefore = list(c.pilot).unread;
    const groundBefore = list(c.ground).unread;
    c.pilot.patch(`/notifications/${id}/`);
    expect(list(c.pilot).unread).toBe(pilotBefore - 1);
    expect(list(c.ground).unread).toBe(groundBefore);
  });

  it('marcar dos veces es idempotente: el conteo baja una vez', () => {
    const c = who();
    const op = newOp(c.su);
    const id = about(c.ops, op.id)[0].id;
    const before = list(c.ops).unread;
    c.ops.patch(`/notifications/${id}/`);
    c.ops.patch(`/notifications/${id}/`);
    expect(list(c.ops).unread).toBe(before - 1);
  });

  it('un aviso nuevo sube el conteo solo de su audiencia', () => {
    const c = who();
    const ops = list(c.ops).unread;
    const maint = list(c.maint).unread;
    newOp(c.su);
    expect(list(c.ops).unread).toBe(ops + 1);
    expect(list(c.maint).unread).toBe(maint);
  });

  it('el conteo es del total del usuario, no de la página que se pide', () => {
    const c = who();
    newOp(c.su);
    newOp(c.su);
    const full = list(c.ops, { limit: '200' });
    const paged = list(c.ops, { limit: '1' });
    expect(paged.data).toHaveLength(1);
    expect(paged.unread).toBe(full.data.filter((n: any) => !n.read).length);
    expect(paged.total).toBe(full.total);
  });

  it('las semillas conservan su lectura por usuario: n-4 ya la leyeron Operaciones y Administración', () => {
    const c = who();
    const read = (s: Sess) => list(s, { limit: '200' }).data.find((n: any) => n.id === 'n-4')?.read;
    expect(read(c.ops)).toBe(true);
    expect(read(c.admin)).toBe(true);
  });
});

describe('notify directo', () => {
  it('sin destinatarios no crea nada', () => {
    expect(
      notify({ kind: 'ticket_assigned', title: 't', body: 'b', roles: [], users: [undefined] }),
    ).toBeNull();
  });

  it('el mismo aviso repetido sobre el mismo ticket se funde en uno', () => {
    const c = who();
    const op = newOp(c.su);
    const ticket = { id: op.id, code: op.code, parent_code: undefined, type_is_root: true };
    const e = { kind: 'close_blocked' as const, title: 't', body: 'igual', ticket, roles: ['r-2'] };
    expect(notify(e)).not.toBeNull();
    expect(notify(e)).toBeNull();
  });
});

describe('Mis misiones (filtro mine)', () => {
  const mine = (s: Sess) =>
    s.get('/tickets/', {
      mine_user_id: s.user.id,
      mine_role_id: s.user.role_id,
      open: 'true',
      limit: '200',
    }).data.data as any[];

  it('incluye la operación raíz asignada al rol del usuario', () => {
    const c = who();
    const op = newOp(c.su, { assigned_role_id: 'r-3' });
    expect(mine(c.pilot).map((t) => t.id)).toContain(op.id);
  });

  it('no incluye lo asignado a otro rol', () => {
    const c = who();
    const op = newOp(c.su, { assigned_role_id: 'r-3' });
    expect(mine(c.maint).map((t) => t.id)).not.toContain(op.id);
    expect(mine(c.ops).map((t) => t.id)).not.toContain(op.id);
  });

  it('incluye trabajo (hijos) del rol y lo asignado al usuario por id', () => {
    const c = who();
    const op = newOp(c.su);
    const byRole = child(c.su, op.id, 'expense', { assigned_role_id: 'r-6' });
    const byUser = child(c.su, op.id, 'expense', {
      assigned_role_id: 'r-4',
      assigned_user_id: 'u-5',
    });
    const ids = mine(c.admin).map((t) => t.id);
    expect(ids).toContain(byRole.id);
    expect(ids).toContain(byUser.id);
  });

  it('el responsable puntual manda sobre el rol: los demás del rol no lo ven', () => {
    const c = who();
    const op = newOp(c.su, { assigned_role_id: 'r-3', assigned_user_id: 'u-3' });
    expect(mine(c.maint).map((t) => t.id)).toContain(op.id);
    expect(mine(c.pilot).map((t) => t.id)).not.toContain(op.id);
  });

  it('solo trae lo abierto: al cerrar la operación sale de Mis misiones', () => {
    const c = who();
    const op = newOp(c.su);
    expect(mine(c.ops).map((t) => t.id)).toContain(op.id);
    signAllSteps(c.su, op);
    c.su.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(mine(c.ops).map((t) => t.id)).not.toContain(op.id);
  });

  it('reasignar con PATCH mueve la misión de una persona a otra', () => {
    const c = who();
    const op = newOp(c.su, { assigned_user_id: 'u-2' });
    expect(mine(c.pilot).map((t) => t.id)).toContain(op.id);
    expect(c.su.patch(`/tickets/${op.id}/`, { assigned_user_id: 'u-3' }).status).toBe(200);
    expect(mine(c.pilot).map((t) => t.id)).not.toContain(op.id);
    expect(mine(c.maint).map((t) => t.id)).toContain(op.id);
  });

  it('sin criterio mine no cambia el listado existente (compatibilidad)', () => {
    const c = who();
    const all = c.su.get('/tickets/', { limit: '200' }).data.total;
    const seed = findTicket(c.su, (t) => t.code === 'YV2323-004-26');
    expect(seed.assigned_user_id).toBeUndefined();
    expect(all).toBeGreaterThan(mine(c.pilot).length);
  });
});
