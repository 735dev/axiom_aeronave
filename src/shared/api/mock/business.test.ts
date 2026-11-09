import { describe, expect, it } from 'vitest';
import { PNG, USERS, findTicket, loginAs } from '@/test/mockApi';
import { normalizeFields, normalizeStatuses } from './routes/ticketSchema';

const sess = () => loginAs(USERS.superuser);
const openOp = (s: ReturnType<typeof loginAs>) =>
  findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
const expense = (s: ReturnType<typeof loginAs>, parent: string, payload: Record<string, unknown>) =>
  s.post('/tickets/', { type_code: 'expense', title: 'g', parent_id: parent, payload });

describe('dos monedas y tasa congelada', () => {
  it('un importe en Bs sin tasa cargada se rechaza, no se convierte con un valor supuesto', () => {
    const s = sess();
    const op = openOp(s);
    s.patch(`/tickets/${op.id}/`, { payload: { exchange_rate: '' } });
    const r = expense(s, op.id, { concept: 'fuel', amount: 100, currency: 'VES' });
    expect(r.status).toBe(422);
  });

  it('con tasa, convierte y congela el valor', () => {
    const s = sess();
    const op = openOp(s);
    s.patch(`/tickets/${op.id}/`, { payload: { exchange_rate: 40 } });
    const r = expense(s, op.id, { concept: 'fuel', amount: 400, currency: 'VES' });
    expect(r.status).toBe(201);
    expect(r.data.money.amount_base).toBe(10);
  });

  it('cambiar la tasa de la operación NO revaloriza un gasto ya registrado al editarlo', () => {
    const s = sess();
    const op = openOp(s);
    s.patch(`/tickets/${op.id}/`, { payload: { exchange_rate: 40 } });
    const exp = expense(s, op.id, { concept: 'fuel', amount: 400, currency: 'VES' }).data;
    s.patch(`/tickets/${op.id}/`, { payload: { exchange_rate: 80 } });
    const edited = s.patch(`/tickets/${exp.id}/`, { payload: { notes: 'nota nueva' } });
    expect(edited.status).toBe(200);
    expect(edited.data.money.amount_base).toBe(10);
  });

  it('cambiar el importe sí revaloriza, con la tasa vigente', () => {
    const s = sess();
    const op = openOp(s);
    s.patch(`/tickets/${op.id}/`, { payload: { exchange_rate: 40 } });
    const exp = expense(s, op.id, { concept: 'fuel', amount: 400, currency: 'VES' }).data;
    s.patch(`/tickets/${op.id}/`, { payload: { exchange_rate: 80 } });
    const edited = s.patch(`/tickets/${exp.id}/`, { payload: { amount: 800 } });
    expect(edited.data.money.amount_base).toBe(10);
  });

  it('gasto en dólares queda a tasa 1', () => {
    const s = sess();
    const r = expense(s, openOp(s).id, { concept: 'fuel', amount: 55.5, currency: 'USD' });
    expect(r.data.money).toMatchObject({ rate: 1, amount_base: 55.5 });
  });
});

describe('normalizadores de tipo de ticket', () => {
  it('conservan el rol semántico y los permisos del campo', () => {
    const [f] = normalizeFields([
      { label: 'Monto', key: 'amount', type: 'money', role: 'amount', view_permission: 'x.view', edit_permission: 'x.edit' },
    ]);
    expect(f).toMatchObject({ role: 'amount', view_permission: 'x.view', edit_permission: 'x.edit' });
  });

  it('conservan counts_as_committed y por omisión un estado cuenta', () => {
    const list = normalizeStatuses([
      { name: 'Abierto', is_initial: true },
      { name: 'Rechazado', is_final: true, counts_as_committed: false },
    ]);
    expect(list[0]?.counts_as_committed).toBe(true);
    expect(list[1]?.counts_as_committed).toBe(false);
  });
});

describe('cierre de operación', () => {
  it('se bloquea mientras haya trabajo asociado sin resolver y dice cuál', () => {
    const s = sess();
    const op = openOp(s);
    const r = s.patch(`/tickets/${op.id}/`, { status_code: 'closed' });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(r.data)).toMatch(/TK-000\d/);
  });
});

describe('cola de validación', () => {
  it('lo de baja confianza va antes que lo de alta confianza', () => {
    const s = sess();
    const op = openOp(s);
    for (const name of ['uno.png', 'dos.png', 'tres.png', 'cuatro.png']) {
      const e = expense(s, op.id, { concept: 'fuel', amount: 10, currency: 'USD' }).data;
      s.post(`/tickets/${e.id}/attachments/`, { name, mime: 'image/png', size: 9, data_url: PNG });
    }
    const queue = s.get('/attachments/pending/', { limit: '100' }).data.data as any[];
    const low = queue.map((q) => (q.file.extraction.fields.some((f: any) => f.confidence === 'low') ? 1 : 0));
    expect(low).toEqual([...low].sort((a, b) => b - a));
  });
});
