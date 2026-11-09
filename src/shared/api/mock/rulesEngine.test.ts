import { describe, expect, it } from 'vitest';
import { USERS, findTicket, loginAs } from '@/test/mockApi';
import { parseRouteLimits, formatRouteLimits } from '@/features/tickets/pages/RulesPage';

const openOp = (s: ReturnType<typeof loginAs>) =>
  findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
const big = (s: ReturnType<typeof loginAs>, amount: number, extra: Record<string, unknown> = {}) =>
  s.post('/tickets/', {
    type_code: 'expense',
    title: 'g',
    parent_id: openOp(s).id,
    payload: { concept: 'fuel', amount, currency: 'USD', ...extra },
  });
const audit = (s: ReturnType<typeof loginAs>) =>
  (s.get('/audit/', { limit: '200' }).data.data as any[]).map((e) => e.summary as string);

describe('motor de reglas', () => {
  it('un gasto sobre 500 USD dispara la regla de autorización', () => {
    const s = loginAs(USERS.superuser);
    expect(big(s, 600).data.rule_hits.map((h: any) => h.rule_id)).toContain('r-1');
  });

  it('un gasto de 100 USD no la dispara', () => {
    const s = loginAs(USERS.superuser);
    expect(big(s, 100).data.rule_hits.map((h: any) => h.rule_id)).not.toContain('r-1');
  });

  it('lo disparado queda en la bitácora con su motivo', () => {
    const s = loginAs(USERS.superuser);
    const t = big(s, 700).data;
    expect(audit(s).some((x) => x.includes(t.code) && x.includes('Se disparó la regla'))).toBe(true);
  });

  it('recalcular no repite el asiento ni cambia la fecha del disparo', () => {
    const s = loginAs(USERS.superuser);
    const t = big(s, 700).data;
    const at = t.rule_hits.find((h: any) => h.rule_id === 'r-1').at;
    s.patch(`/tickets/${t.id}/`, { payload: { notes: 'a' } });
    s.patch(`/tickets/${t.id}/`, { payload: { notes: 'b' } });
    const again = s.get(`/tickets/${t.id}/`).data;
    expect(again.rule_hits.find((h: any) => h.rule_id === 'r-1').at).toBe(at);
    expect(audit(s).filter((x) => x.includes(t.code) && x.includes('r-1') === false && x.includes('Se disparó la regla "Gasto mayor'))).toHaveLength(1);
  });

  it('regla por ruta: fuera de rango en CCS-PZO (tope 1200) dispara; dentro no', () => {
    const s = loginAs(USERS.superuser);
    const route = `${openOp(s).payload.origin}-${openOp(s).payload.destination}`;
    expect(route).toBe('CCS-PZO');
    expect(big(s, 1300).data.rule_hits.map((h: any) => h.rule_id)).toContain('r-4');
    expect(big(s, 1100).data.rule_hits.map((h: any) => h.rule_id)).not.toContain('r-4');
  });

  it('una ruta sin tope no inventa uno', () => {
    const s = loginAs(USERS.superuser);
    s.patch('/rules/r-4/', { route_limits: { 'XXX-YYY': 1 } });
    expect(big(s, 99999).data.rule_hits.map((h: any) => h.rule_id)).not.toContain('r-4');
    s.patch('/rules/r-4/', { route_limits: { 'CCS-PZO': 1200, 'CCS-SVSA': 900 } });
  });
});

describe('autorización de la dirección', () => {
  it('sin autorización no se puede dar por bueno un gasto marcado', () => {
    const s = loginAs(USERS.superuser);
    const t = big(s, 800).data;
    const r = s.patch(`/tickets/${t.id}/`, { status_code: 'verified' });
    expect(r.status).toBe(422);
    expect(JSON.stringify(r.data)).toMatch(/autorizaci/);
  });

  it('rechazarlo sí se puede sin autorización', () => {
    const s = loginAs(USERS.superuser);
    const t = big(s, 800).data;
    expect(s.patch(`/tickets/${t.id}/`, { status_code: 'rejected' }).status).toBe(200);
  });

  it('quien no tiene el permiso recibe 403 al autorizar', () => {
    const owner = loginAs(USERS.superuser);
    const t = big(owner, 800).data;
    expect(loginAs(USERS.pilot).post(`/tickets/${t.id}/authorize/`, {}).status).toBe(403);
    expect(owner.get(`/tickets/${t.id}/`).data.authorization).toBeUndefined();
  });

  it('autorizado por la dirección, queda sellado y se puede verificar', () => {
    const s = loginAs(USERS.director);
    const t = big(s, 800).data;
    const a = s.post(`/tickets/${t.id}/authorize/`, { note: 'ok' });
    expect(a.status).toBe(200);
    expect(a.data.authorization).toMatchObject({ by: 'Gerencia General', amount_base: 800 });
    expect(s.patch(`/tickets/${t.id}/`, { status_code: 'verified' }).status).toBe(200);
  });

  it('la autorización queda en la bitácora como decisión', () => {
    const s = loginAs(USERS.director);
    const t = big(s, 800).data;
    s.post(`/tickets/${t.id}/authorize/`, {});
    const ev = s.get('/audit/', { limit: '100' }).data.data as any[];
    expect(ev.some((e) => e.action === 'decision' && e.entity_id === t.id)).toBe(true);
  });

  it('si el importe cambia después, la autorización deja de valer', () => {
    const s = loginAs(USERS.director);
    const t = big(s, 800).data;
    s.post(`/tickets/${t.id}/authorize/`, {});
    s.patch(`/tickets/${t.id}/`, { payload: { amount: 900 } });
    expect(s.patch(`/tickets/${t.id}/`, { status_code: 'verified' }).status).toBe(422);
  });

  it('no se autoriza lo que no lo necesita', () => {
    const s = loginAs(USERS.director);
    const t = big(s, 50).data;
    expect(s.post(`/tickets/${t.id}/authorize/`, {}).status).toBe(422);
  });

  it('en un expediente cerrado no se autoriza (409)', () => {
    const s = loginAs(USERS.director);
    const t = big(s, 50).data;
    s.patch(`/tickets/${t.id}/`, { status_code: 'rejected' });
    expect(s.post(`/tickets/${t.id}/authorize/`, {}).status).toBe(409);
  });

  it('sin el visto bueno la operación no se puede cerrar por ese gasto pendiente', () => {
    const s = loginAs(USERS.director);
    const op = openOp(s);
    big(s, 800);
    expect(s.patch(`/tickets/${op.id}/`, { status_code: 'closed' }).status).toBeGreaterThanOrEqual(400);
  });
});

describe('edición de reglas', () => {
  it('se edita el mensaje y queda guardado', () => {
    const s = loginAs(USERS.superuser);
    const r = s.patch('/rules/r-3/', { message: 'nuevo mensaje' });
    expect(r.data.message).toBe('nuevo mensaje');
    expect((s.get('/rules/').data as any[]).find((x) => x.id === 'r-3').message).toBe('nuevo mensaje');
  });

  it('una regla desactivada no se dispara', () => {
    const s = loginAs(USERS.superuser);
    s.patch('/rules/r-1/', { is_active: false });
    expect(big(s, 900).data.rule_hits.map((h: any) => h.rule_id)).not.toContain('r-1');
    s.patch('/rules/r-1/', { is_active: true });
  });

  it('el motivo avisado se congela aunque la regla se edite después', () => {
    const s = loginAs(USERS.superuser);
    const t = big(s, 900).data;
    const before = t.rule_hits.find((h: any) => h.rule_id === 'r-1').message;
    s.patch('/rules/r-1/', { message: 'otro texto' });
    s.patch(`/tickets/${t.id}/`, { payload: { notes: 'x' } });
    expect(s.get(`/tickets/${t.id}/`).data.rule_hits.find((h: any) => h.rule_id === 'r-1').message).toBe(before);
    s.patch('/rules/r-1/', { message: before });
  });

  it('topes por ruta: se leen y se escriben sin perder datos', () => {
    expect(parseRouteLimits('ccs-pzo=1200\nCCS-SVSA = 900,5\nbasura\n')).toEqual({ 'CCS-PZO': 1200, 'CCS-SVSA': 900.5 });
    expect(parseRouteLimits('nada')).toBeUndefined();
    expect(parseRouteLimits(formatRouteLimits({ 'A-B': 10 }))).toEqual({ 'A-B': 10 });
  });

  it('se crea una regla por ruta con sus topes', () => {
    const s = loginAs(USERS.superuser);
    const r = s.post('/rules/', { name: 'x', type_code: 'expense', field: 'amount_vs_route', operator: 'gt', action: 'warn', message: 'm', route_limits: { 'CCS-PZO': 10 } });
    expect(r.data.route_limits).toEqual({ 'CCS-PZO': 10 });
  });
});
