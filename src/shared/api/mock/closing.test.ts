import { describe, expect, it } from 'vitest';
import { routeMockRequest } from './router';
import { PNG, SIGNING_STEPS, USERS, dataUrlOfBytes, loginAs, newExpense } from '@/test/mockApi';

type Sess = ReturnType<typeof loginAs>;

const PDF = 'data:application/pdf;base64,JVBERi0=';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const ops = () => loginAs(USERS.operations);

const newOp = (s: Sess) =>
  s.post('/tickets/', {
    type_code: 'operation',
    title: 'Vuelo de cierre',
    payload: { date: '2026-09-10', origin: 'CCS', destination: 'PZO', aircraft: 'YV2323' },
  }).data;
const kids = (s: Sess, id: string) =>
  s.get('/tickets/', { parent_id: id, limit: '50' }).data.data as any[];
const closing = (s: Sess, id: string) => s.get(`/tickets/${id}/closing/`);
const attach = (
  s: Sess,
  id: string,
  name = 'soporte.pdf',
  data_url = PDF,
  mime = 'application/pdf',
) => s.post(`/tickets/${id}/attachments/`, { name, mime, size: 9, data_url });
const sign = (s: Sess, id: string, step: string = SIGNING_STEPS[0]) =>
  s.post(`/tickets/${id}/decisions/`, { step_code: step, decision: 'done' });
/** Las cuatro firmas del cierre con una misma sesión (Operaciones decide por cualquier rol). */
const signAll = (s: Sess, id: string) => SIGNING_STEPS.forEach((step) => sign(s, id, step));
const auditEvents = (s: Sess) => (s.get('/audit/', { limit: '100' }).data.data ?? []) as any[];

/** Operación con todo resuelto salvo las firmas: pasos, reporte técnico y gastos con soporte. */
function readyOp(s: Sess = ops()) {
  const op = newOp(s);
  ['planning', 'requirements', 'ground', 'technical'].forEach((step_code) =>
    s.post(`/tickets/${op.id}/decisions/`, { step_code, decision: 'done' }),
  );
  const tech = (s.get('/ticket-types/').data as any[]).find((t) => t.code === 'technical_report');
  kids(s, op.id)
    .filter((t) => t.type_code === 'technical_report')
    .forEach((t) => {
      tech.steps.forEach((st: any) =>
        s.post(`/tickets/${t.id}/decisions/`, { step_code: st.code, decision: 'done' }),
      );
      s.patch(`/tickets/${t.id}/`, { status_code: 'solved' });
    });
  return op;
}

describe('firma en el propio perfil', () => {
  it('sube una firma PNG y se lee de vuelta', () => {
    const s = ops();
    expect(s.patch('/auth/me/signature/', { signature_url: PNG }).status).toBe(200);
    expect(s.get('/auth/me/signature/').data.signature_url).toBe(PNG);
  });

  it('acepta JPEG', () => {
    const s = ops();
    expect(s.patch('/auth/me/signature/', { signature_url: JPG }).status).toBe(200);
  });

  it('rechaza un tipo que no es PNG ni JPEG con 422 y no cambia la firma', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const r = s.patch('/auth/me/signature/', { signature_url: 'data:image/gif;base64,R0lGODlh' });
    expect(r.status).toBe(422);
    expect(s.get('/auth/me/signature/').data.signature_url).toBe(PNG);
  });

  it('rechaza un PDF disfrazado de firma', () => {
    expect(ops().patch('/auth/me/signature/', { signature_url: PDF }).status).toBe(422);
  });

  it('rechaza más de 300 KB y acepta justo 300 KB', () => {
    const s = ops();
    expect(
      s.patch('/auth/me/signature/', { signature_url: dataUrlOfBytes(300 * 1024 + 1, 'image/png') })
        .status,
    ).toBe(422);
    expect(
      s.patch('/auth/me/signature/', { signature_url: dataUrlOfBytes(300 * 1024, 'image/png') })
        .status,
    ).toBe(200);
  });

  it('rechaza un texto que no es una imagen en data URL', () => {
    expect(
      ops().patch('/auth/me/signature/', { signature_url: 'https://x.test/f.png' }).status,
    ).toBe(422);
  });

  it('sin sesión responde 401', () => {
    const r = routeMockRequest({
      method: 'patch',
      path: '/auth/me/signature/',
      query: new URLSearchParams(),
      body: { signature_url: PNG },
    });
    expect(r.status).toBe(401);
  });

  it('el dueño sale del token: un user_id en el cuerpo se ignora', () => {
    const s = ops();
    const pilot = loginAs(USERS.pilot);
    pilot.patch('/auth/me/signature/', { signature_url: '' });
    s.patch('/auth/me/signature/', {
      signature_url: PNG,
      user_id: pilot.user.id,
      id: pilot.user.id,
    });
    expect(pilot.get('/auth/me/signature/').data.signature_url).toBeNull();
    expect(s.get('/auth/me/signature/').data.signature_url).toBe(PNG);
  });

  it('quitar la firma con cadena vacía la borra', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    expect(s.patch('/auth/me/signature/', { signature_url: '' }).status).toBe(200);
    expect(s.get('/auth/me/signature/').data.signature_url).toBeNull();
  });

  it('cada alta, reemplazo y baja queda en la bitácora sin guardar la imagen', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: '' });
    s.patch('/auth/me/signature/', { signature_url: PNG });
    s.patch('/auth/me/signature/', { signature_url: JPG });
    s.patch('/auth/me/signature/', { signature_url: '' });
    const texts = auditEvents(s)
      .filter((e) => e.entity_id === s.user.id && e.action === 'permission_change')
      .map((e) => e.summary);
    expect(texts.slice(0, 3)).toEqual([
      'Eliminó la firma de Freya Marcano',
      'Reemplazó la firma de Freya Marcano',
      'Cargó la firma de Freya Marcano',
    ]);
    expect(JSON.stringify(auditEvents(s))).not.toContain('iVBORw0KGgo');
  });

  it('un rechazo por tipo no asienta nada en la bitácora', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const before = auditEvents(s).length;
    s.patch('/auth/me/signature/', { signature_url: PDF });
    expect(auditEvents(s).length).toBe(before);
  });

  it('la decisión de firma copia la rúbrica de quien decide, no la de otro', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const pilot = loginAs(USERS.pilot);
    pilot.patch('/auth/me/signature/', { signature_url: '' });
    const op = newOp(s);
    const step = SIGNING_STEPS[0];
    const bySuper = sign(pilot, op.id).data.decisions.find((d: any) => d.step_code === step);
    expect(bySuper.signature_url).toBeUndefined();
    const byOps = sign(s, op.id).data.decisions.find((d: any) => d.step_code === step);
    expect(byOps.signature_url).toBe(PNG);
  });
});

describe('resumen de cierre: alcance', () => {
  it('un id desconocido responde 404', () => {
    expect(closing(ops(), 'no-existe').status).toBe(404);
  });

  it('un ticket que no es raíz responde 404', () => {
    const s = ops();
    const op = newOp(s);
    const exp = newExpense(s, op.id).data;
    expect(closing(s, exp.id).status).toBe(404);
  });

  it('una operación responde 200 con su código', () => {
    const s = ops();
    const op = newOp(s);
    const r = closing(s, op.id);
    expect(r.status).toBe(200);
    expect(r.data.ticket_code).toBe(op.code);
    expect(r.data.closed).toBe(false);
  });
});

describe('resumen de cierre: avance por rol', () => {
  it('suma los pasos de la operación y de sus hijos, agrupados por rol responsable', () => {
    const s = ops();
    const op = newOp(s);
    const types = s.get('/ticket-types/').data as any[];
    const members = [op, ...kids(s, op.id)];
    const expected = members.reduce(
      (n, t) => n + types.find((x) => x.code === t.type_code).steps.length,
      0,
    );
    const progress = closing(s, op.id).data.progress as any[];
    expect(progress.reduce((n, r) => n + r.total, 0)).toBe(expected);
    expect(progress.reduce((n, r) => n + r.done, 0)).toBe(0);
  });

  it('un paso registrado pasa de pendiente a hecho en su rol', () => {
    const s = ops();
    const op = newOp(s);
    const row = () =>
      (closing(s, op.id).data.progress as any[]).find(
        (r) => r.role_name === 'Gerencia de Operaciones',
      );
    const before = row();
    s.post(`/tickets/${op.id}/decisions/`, { step_code: 'planning', decision: 'done' });
    const after = row();
    expect(after.done).toBe(before.done + 1);
    expect(before.pending.some((p: string) => p.includes('Planificación'))).toBe(true);
    expect(after.pending.some((p: string) => p.includes('Planificación'))).toBe(false);
  });

  it('los pendientes nombran el ticket al que pertenecen', () => {
    const s = ops();
    const op = newOp(s);
    const tech = kids(s, op.id).find((t) => t.type_code === 'technical_report');
    const all = (closing(s, op.id).data.progress as any[]).flatMap((r) => r.pending as string[]);
    expect(all.some((p) => p.startsWith(`${tech.code} ·`))).toBe(true);
  });
});

describe('resumen de cierre: gastos y totales', () => {
  it('los totales coinciden con computeTotals (el mismo que usa la pantalla de totales)', () => {
    const s = ops();
    const op = newOp(s);
    newExpense(s, op.id, { amount: 100, currency: 'USD' });
    expect(newExpense(s, op.id, { amount: 5000, currency: 'VES', exchange_rate: 50 }).status).toBe(
      201,
    );
    const mine = closing(s, op.id).data.totals;
    const other = s.get('/tickets/totals/', { parent_id: op.id }).data;
    expect(mine).toEqual(other);
    expect(mine.by_currency.map((c: any) => c.currency).sort()).toEqual(['USD', 'VES']);
  });

  it('lista cada gasto con código, concepto, monto, moneda, base y soporte', () => {
    const s = ops();
    const op = newOp(s);
    const a = newExpense(s, op.id, { amount: 100, currency: 'USD' }).data;
    const b = newExpense(s, op.id, { amount: 40, currency: 'USD' }).data;
    attach(s, a.id);
    const rows = closing(s, op.id).data.expenses as any[];
    expect(rows).toHaveLength(2);
    const ra = rows.find((r) => r.code === a.code);
    expect(ra).toMatchObject({ amount: 100, currency: 'USD', has_support: true });
    expect(ra.concept).toBeTruthy();
    expect(rows.find((r) => r.code === b.code).has_support).toBe(false);
    expect(ra.amount_base).toBe(a.money.amount_base);
  });

  it('separa lo confirmado de lo en curso, en base y por moneda', () => {
    const s = ops();
    const op = newOp(s);
    const a = newExpense(s, op.id, { amount: 100, currency: 'USD' }).data;
    const b = newExpense(s, op.id, { amount: 30, currency: 'USD' }).data;
    s.patch(`/tickets/${a.id}/`, { status_code: 'verified' });
    const d = closing(s, op.id).data;
    expect(d.confirmed.base).toBe(a.money.amount_base);
    expect(d.in_progress.base).toBe(b.money.amount_base);
    expect(d.confirmed.by_currency[0]).toMatchObject({ currency: 'USD', amount: 100 });
    expect(d.in_progress.by_currency[0]).toMatchObject({ currency: 'USD', amount: 30 });
  });

  it('un gasto rechazado no suma ni confirmado ni en curso, y se marca como que no cuenta', () => {
    const s = ops();
    const op = newOp(s);
    const a = newExpense(s, op.id, { amount: 100, currency: 'USD' }).data;
    s.patch(`/tickets/${a.id}/`, { status_code: 'rejected' });
    const d = closing(s, op.id).data;
    expect(d.confirmed.base + d.in_progress.base).toBe(0);
    expect(d.expenses[0].counts).toBe(false);
    expect(d.totals.excluded_base).toBeGreaterThan(0);
  });
});

describe('resumen de cierre: inventario de soportes', () => {
  it('consolida los archivos de la operación y de sus hijos', () => {
    const s = ops();
    const op = newOp(s);
    const exp = newExpense(s, op.id).data;
    attach(s, op.id, 'manifiesto.pdf');
    attach(s, exp.id, 'factura.pdf');
    const inv = closing(s, op.id).data.supports as any[];
    expect(inv.map((i) => i.ticket_code).sort()).toEqual([op.code, exp.code].sort());
    expect(inv.every((i) => i.filename && i.folder && i.uploaded_by)).toBe(true);
  });

  it('cuenta por tipo de documento', () => {
    const s = ops();
    const op = newOp(s);
    const e1 = newExpense(s, op.id).data;
    const e2 = newExpense(s, op.id).data;
    attach(s, e1.id, 'a.pdf');
    attach(s, e2.id, 'b.pdf');
    attach(s, op.id, 'm.pdf');
    const by = Object.fromEntries(
      (closing(s, op.id).data.supports_by_type as any[]).map((x) => [x.document_type, x.count]),
    );
    expect(by.comprobante).toBe(2);
    expect(by.manifiesto).toBe(1);
  });

  it('no mezcla archivos de otra operación', () => {
    const s = ops();
    const a = newOp(s);
    const b = newOp(s);
    attach(s, newExpense(s, b.id).data.id);
    expect(closing(s, a.id).data.supports).toHaveLength(0);
  });
});

describe('resumen de cierre: bloqueos', () => {
  it('lista el hijo sin resolver con su código y los pasos obligatorios pendientes', () => {
    const s = ops();
    const op = newOp(s);
    const tech = kids(s, op.id).find((t) => t.type_code === 'technical_report');
    const d = closing(s, op.id).data;
    expect(d.blockers).toContainEqual(
      expect.objectContaining({ kind: 'unresolved_child', ticket_code: tech.code }),
    );
    expect(
      d.blockers.some((b: any) => b.kind === 'pending_step' && b.step_code === 'planning'),
    ).toBe(true);
    expect(d.ready).toBe(false);
  });

  it('un gasto sin soporte bloquea y apunta al gasto', () => {
    const s = ops();
    const op = readyOp(s);
    const exp = newExpense(s, op.id).data;
    const d = closing(s, op.id).data;
    expect(d.blockers).toContainEqual(
      expect.objectContaining({ kind: 'expense_without_support', ticket_id: exp.id }),
    );
    expect(d.ready).toBe(false);
  });

  it('un comprobante leído y sin validar bloquea', () => {
    const s = ops();
    const op = readyOp(s);
    const exp = newExpense(s, op.id).data;
    attach(s, exp.id, 'recibo.png', PNG, 'image/png');
    const d = closing(s, op.id).data;
    expect(d.blockers.some((b: any) => b.kind === 'receipt_awaiting_validation')).toBe(true);
    expect(d.ready).toBe(false);
  });

  it('con todo resuelto salvo las firmas, cada firma faltante es un bloqueo con su rol', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const op = readyOp(s);
    attach(s, newExpense(s, op.id).data.id);
    const d = closing(s, op.id).data;
    expect(d.blockers.map((b: any) => [b.kind, b.step_code])).toEqual(
      SIGNING_STEPS.map((step) => ['signature', step]),
    );
    expect(d.blockers.map((b: any) => b.role_name)).toEqual([
      'Piloto',
      'Mantenimiento',
      'Coordinación AVSEC',
      'Gerencia General',
    ]);
    expect(d.ready).toBe(false);
  });

  it('con todo resuelto y las cuatro firmas, ready es verdadero', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const op = readyOp(s);
    attach(s, newExpense(s, op.id).data.id);
    signAll(s, op.id);
    const d = closing(s, op.id).data;
    expect(d.blockers).toEqual([]);
    expect(d.ready).toBe(true);
  });

  it('el PATCH de cierre rechaza un gasto sin soporte con 422 y nombra el gasto', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const op = readyOp(s);
    const exp = newExpense(s, op.id).data;
    signAll(s, op.id);
    const r = s.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(r.status).toBe(422);
    expect(r.data.detail).toContain(exp.code);
  });

  it('el PATCH de cierre rechaza comprobantes sin validar', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const op = readyOp(s);
    attach(s, newExpense(s, op.id).data.id, 'recibo.png', PNG, 'image/png');
    signAll(s, op.id);
    const r = s.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(r.status).toBe(422);
    expect(r.data.detail).toMatch(/sin validar/);
  });
});

describe('resumen de cierre: firmantes', () => {
  it('lista los cuatro pasos firmables en orden, con su rol, sin firmar', () => {
    const op = newOp(ops());
    const d = closing(ops(), op.id).data;
    expect(d.signers.map((x: any) => x.step_code)).toEqual([...SIGNING_STEPS]);
    expect(d.signers.map((x: any) => x.role_code)).toEqual([
      'pilot',
      'maintenance',
      'avsec',
      'executive',
    ]);
    d.signers.forEach((x: any) => {
      expect(x).toMatchObject({ required: true, signed: false, signed_by_name: null, signed_at: null });
    });
  });

  it('informa si el usuario tiene firma cargada', () => {
    const s = ops();
    const op = newOp(s);
    s.patch('/auth/me/signature/', { signature_url: '' });
    expect(closing(s, op.id).data.signers.every((x: any) => x.has_signature === false)).toBe(true);
    s.patch('/auth/me/signature/', { signature_url: PNG });
    expect(closing(s, op.id).data.signers.every((x: any) => x.has_signature === true)).toBe(true);
  });

  it('puede firmar quien tiene el rol del paso o decide_any', () => {
    const op = newOp(ops());
    const canSign = (email: string) =>
      (closing(loginAs(email), op.id).data.signers as any[]).map((x) => x.can_sign);
    expect(canSign(USERS.operations)).toEqual([true, true, true, true]);
    expect(canSign(USERS.superuser)).toEqual([true, true, true, true]);
    expect(canSign(USERS.pilot)).toEqual([true, false, false, false]);
    expect(canSign(USERS.maintenance)).toEqual([false, true, false, false]);
    expect(canSign(USERS.avsec)).toEqual([false, false, true, false]);
    expect(canSign(USERS.director)).toEqual([true, true, true, true]);
  });

  it('cada firmante queda firmado con su nombre y hora al decidir', () => {
    const op = newOp(ops());
    const pilot = loginAs(USERS.pilot);
    pilot.patch('/auth/me/signature/', { signature_url: PNG });
    sign(pilot, op.id, 'sign_captain');
    const [captain, maintenance] = closing(ops(), op.id).data.signers;
    expect(captain).toMatchObject({ signed: true, signed_by_name: 'Cap. Luis Rodríguez' });
    expect(new Date(captain.signed_at).getTime()).not.toBeNaN();
    expect(maintenance.signed).toBe(false);
  });

  it('un rol ajeno no puede firmar el paso de otro: 403', () => {
    const op = newOp(ops());
    const pilot = loginAs(USERS.pilot);
    expect(sign(pilot, op.id, 'sign_maintenance').status).toBe(403);
    expect(sign(pilot, op.id, 'sign_captain').status).toBe(200);
  });
});

describe('cierre firmado', () => {
  it('sin firma cargada bloquea con 422 y un mensaje claro; la operación sigue abierta', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: '' });
    const op = readyOp(s);
    signAll(s, op.id);
    const r = s.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(r.status).toBe(422);
    expect(r.data.detail).toContain('cargar su firma en su perfil');
    const now = s.get(`/tickets/${op.id}/`).data;
    expect(now.status_is_final).toBe(false);
    expect(now.closing).toBeUndefined();
  });

  it('tras cargar la firma y firmar de nuevo, el cierre procede', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: '' });
    const op = readyOp(s);
    signAll(s, op.id);
    expect(s.patch(`/tickets/${op.id}/`, { status_code: 'closed' }).status).toBe(422);
    s.patch('/auth/me/signature/', { signature_url: PNG });
    signAll(s, op.id);
    expect(s.patch(`/tickets/${op.id}/`, { status_code: 'closed' }).status).toBe(200);
  });

  it('sin las decisiones de firma no se cierra aunque la firma esté cargada', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const op = readyOp(s);
    expect(s.patch(`/tickets/${op.id}/`, { status_code: 'closed' }).status).toBe(422);
  });

  it('con una sola firma faltante no se cierra y el mensaje nombra a quien falta', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const op = readyOp(s);
    SIGNING_STEPS.slice(0, 3).forEach((step) => sign(s, op.id, step));
    const r = s.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(r.status).toBe(422);
    expect(r.data.detail).toContain('Gerencia General');
    expect(s.get(`/tickets/${op.id}/`).data.status_is_final).toBe(false);
  });

  it('cuatro firmantes distintos sellan cuatro firmas, cada una con su nombre y su rúbrica', () => {
    const owner = ops();
    owner.patch('/auth/me/signature/', { signature_url: PNG });
    const op = readyOp(owner);
    const signers = [
      [USERS.pilot, SIGNING_STEPS[0]],
      [USERS.maintenance, SIGNING_STEPS[1]],
      [USERS.avsec, SIGNING_STEPS[2]],
      [USERS.director, SIGNING_STEPS[3]],
    ] as const;
    signers.forEach(([email, step]) => {
      const u = loginAs(email);
      u.patch('/auth/me/signature/', { signature_url: JPG });
      expect(sign(u, op.id, step).status).toBe(200);
    });
    expect(owner.patch(`/tickets/${op.id}/`, { status_code: 'closed' }).status).toBe(200);
    const sigs = closing(owner, op.id).data.stamp.signatures as any[];
    expect(sigs.map((x) => x.user_name)).toEqual([
      'Cap. Luis Rodríguez',
      'Ramón Prieto',
      'Coordinación AVSEC',
      'Gerencia General',
    ]);
    sigs.forEach((x) => expect(x.signature_url).toBe(JPG));
  });

  it('el sello trae quién, rol, rúbrica, cuándo, totales, archivos y carpeta', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const op = readyOp(s);
    const exp = newExpense(s, op.id, { amount: 100, currency: 'USD' }).data;
    attach(s, exp.id);
    attach(s, op.id, 'm.pdf');
    s.patch(`/tickets/${exp.id}/`, { status_code: 'verified' });
    signAll(s, op.id);
    const before = closing(s, op.id).data;
    expect(s.patch(`/tickets/${op.id}/`, { status_code: 'closed' }).status).toBe(200);
    const stamp = s.get(`/tickets/${op.id}/`).data.closing;
    expect(stamp).toMatchObject({
      signed_by: 'Freya Marcano',
      signature_url: PNG,
      files_count: 2,
    });
    expect(stamp.signatures.map((x: any) => x.step_code)).toEqual([...SIGNING_STEPS]);
    expect(stamp.signatures.map((x: any) => x.role_name)).toEqual([
      'Piloto',
      'Mantenimiento',
      'Coordinación AVSEC',
      'Gerencia General',
    ]);
    expect(new Date(stamp.signed_at).getTime()).not.toBeNaN();
    expect(stamp.folder).toMatch(/^20\d\d-/);
    expect(stamp.totals.committed_base).toBe(exp.money.amount_base);
    expect(stamp.totals).toEqual(before.totals);
  });

  it('el resumen de una operación cerrada marca closed', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const op = readyOp(s);
    signAll(s, op.id);
    s.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(closing(s, op.id).data.closed).toBe(true);
  });

  it('anular cierra sin sello ni exigir firma', () => {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: '' });
    const op = newOp(s);
    expect(s.patch(`/tickets/${op.id}/`, { status_code: 'cancelled' }).status).toBe(200);
    expect(s.get(`/tickets/${op.id}/`).data.closing).toBeUndefined();
  });

  it('un gasto que se cierra no recibe sello (solo las raíces)', () => {
    const s = ops();
    const op = newOp(s);
    const exp = newExpense(s, op.id).data;
    s.patch(`/tickets/${exp.id}/`, { status_code: 'verified' });
    expect(s.get(`/tickets/${exp.id}/`).data.closing).toBeUndefined();
  });
});

describe('sello inmutable', () => {
  function closed() {
    const s = ops();
    s.patch('/auth/me/signature/', { signature_url: PNG });
    const op = readyOp(s);
    signAll(s, op.id);
    s.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    return { s, op };
  }

  it('cualquier cambio posterior responde 409', () => {
    const { s, op } = closed();
    expect(s.patch(`/tickets/${op.id}/`, { title: 'otro' }).status).toBe(409);
    expect(s.patch(`/tickets/${op.id}/`, { status_code: 'planned' }).status).toBe(409);
  });

  it('no se puede reescribir el sello por el cuerpo del PATCH', () => {
    const { s, op } = closed();
    const stamp = s.get(`/tickets/${op.id}/`).data.closing;
    const r = s.patch(`/tickets/${op.id}/`, { closing: { ...stamp, signed_by: 'Otro' } });
    expect(r.status).toBe(409);
    expect(s.get(`/tickets/${op.id}/`).data.closing.signed_by).toBe('Freya Marcano');
  });

  it('volver a firmar tras el cierre responde 409 y el intento queda como denied', () => {
    const { s, op } = closed();
    expect(sign(s, op.id).status).toBe(409);
    expect(auditEvents(s).some((e) => e.action === 'denied' && e.entity_id === op.id)).toBe(true);
  });

  it('cambiar la firma del perfil después no altera lo ya sellado', () => {
    const { s, op } = closed();
    s.patch('/auth/me/signature/', { signature_url: JPG });
    expect(s.get(`/tickets/${op.id}/`).data.closing.signature_url).toBe(PNG);
  });

  it('el soporte no se puede agregar a un expediente sellado', () => {
    const { s, op } = closed();
    expect(attach(s, op.id).status).toBe(409);
  });
});
