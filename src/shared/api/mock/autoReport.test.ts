import { describe, expect, it } from 'vitest';
import { USERS, loginAs } from '@/test/mockApi';

const newOp = (s: ReturnType<typeof loginAs>) =>
  s.post('/tickets/', {
    type_code: 'operation',
    title: 'Vuelo',
    payload: { date: '2026-09-10', origin: 'CCS', destination: 'PZO', aircraft: 'YV2323' },
  }).data;
const kids = (s: ReturnType<typeof loginAs>, id: string) =>
  s.get('/tickets/', { parent_id: id, limit: '50' }).data.data as any[];

describe('reporte técnico automático por operación', () => {
  it('una operación nueva nace con su reporte técnico abierto, asignado al piloto', () => {
    const s = loginAs(USERS.superuser);
    const op = newOp(s);
    const reports = kids(s, op.id).filter((t) => t.type_code === 'technical_report');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ status_is_final: false, assigned_role_id: 'r-3' });
  });

  it('el reporte trae has_finding en falso (sin novedad hasta que el piloto diga otra cosa)', () => {
    const s = loginAs(USERS.superuser);
    const r = kids(s, newOp(s).id)[0];
    expect(r.payload.has_finding).toBe(false);
  });

  it('bloquea el cierre de la operación mientras no se resuelva', () => {
    const s = loginAs(USERS.superuser);
    const op = newOp(s);
    ['planning', 'requirements', 'ground', 'technical', 'signature'].forEach((c) =>
      s.post(`/tickets/${op.id}/decisions/`, { step_code: c, decision: 'done' }),
    );
    const r = s.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(r.status).toBe(422);
    expect(JSON.stringify(r.data)).toMatch(/TK-/);
  });

  it('anular la operación no exige resolver el reporte', () => {
    const s = loginAs(USERS.superuser);
    expect(s.patch(`/tickets/${newOp(s).id}/`, { status_code: 'cancelled' }).status).toBe(200);
  });

  it('el reporte automático no avisa a Mantenimiento (aún no hay novedad)', () => {
    const s = loginAs(USERS.superuser);
    const m = loginAs(USERS.maintenance);
    const before = (m.get('/notifications/').data as any).unread;
    newOp(s);
    expect((m.get('/notifications/').data as any).unread).toBe(before);
  });

  it('crear dos operaciones no mezcla sus reportes', () => {
    const s = loginAs(USERS.superuser);
    const a = newOp(s);
    const b = newOp(s);
    const ids = (x: any) => kids(s, x.id).map((t) => t.id);
    expect(ids(a).filter((i) => ids(b).includes(i))).toEqual([]);
  });

  it('"Sin novedad" resuelve el reporte sin pasos de mantenimiento y deja cerrar la operación', () => {
    const s = loginAs(USERS.superuser);
    const op = newOp(s);
    const report = kids(s, op.id)[0];
    expect(s.patch(`/tickets/${report.id}/`, { status_code: 'no_findings' }).status).toBe(200);
    // Quien firma el cierre necesita su rúbrica cargada.
    s.patch('/auth/me/signature/', { signature_url: 'data:image/png;base64,iVBORw0KGgo=' });
    ['planning', 'requirements', 'ground', 'technical', 'signature'].forEach((c) =>
      s.post(`/tickets/${op.id}/decisions/`, { step_code: c, decision: 'done' }),
    );
    expect(s.patch(`/tickets/${op.id}/`, { status_code: 'closed' }).status).toBe(200);
  });

  it('un reporte ya resuelto no admite más soportes (el estado final va al último)', () => {
    const s = loginAs(USERS.superuser);
    const report = kids(s, newOp(s).id)[0];
    s.patch(`/tickets/${report.id}/`, { status_code: 'no_findings' });
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(s.post(`/tickets/${report.id}/attachments/`, { name: 'a.png', mime: 'image/png', size: 9, data_url: png }).status).toBe(409);
  });
});
