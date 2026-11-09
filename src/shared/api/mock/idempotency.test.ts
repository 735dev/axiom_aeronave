import { describe, expect, it } from 'vitest';
import { USERS, findTicket, loginAs } from '@/test/mockApi';

const make = (s: ReturnType<typeof loginAs>, parent: string, key: string, amount = 100) =>
  s.post('/tickets/', { type_code: 'expense', title: 'g', parent_id: parent, payload: { concept: 'fuel', amount, currency: 'USD' } }, key);
const total = (s: ReturnType<typeof loginAs>) => (s.get('/tickets/', { limit: '500' }).data.data as any[]).length;

describe('Idempotency-Key en el mock', () => {
  it('mismo usuario, misma clave y mismo cuerpo: una sola creación y la misma respuesta', () => {
    const s = loginAs(USERS.superuser);
    const op = findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
    const n = total(s);
    const a = make(s, op.id, 'k-same');
    const b = make(s, op.id, 'k-same');
    expect(a.data.id).toBe(b.data.id);
    expect(total(s)).toBe(n + 1);
  });

  it('misma clave con otro cuerpo es 422 y no crea nada', () => {
    const s = loginAs(USERS.superuser);
    const op = findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
    make(s, op.id, 'k-body', 100);
    const n = total(s);
    const r = make(s, op.id, 'k-body', 999);
    expect(r.status).toBe(422);
    expect(r.data.codigo).toBe('idempotencia');
    expect(total(s)).toBe(n);
  });

  it('otro usuario con la misma clave NO recibe la respuesta ajena', () => {
    const a = loginAs(USERS.superuser);
    const b = loginAs(USERS.operations);
    const op = findTicket(a, (t) => t.type_code === 'operation' && !t.status_is_final);
    const ra = make(a, op.id, 'k-shared');
    const rb = make(b, op.id, 'k-shared');
    if (rb.status < 300) expect(rb.data.id).not.toBe(ra.data.id);
  });

  it('un rechazo no se recuerda: corregir y reenviar con la misma clave funciona', () => {
    const s = loginAs(USERS.superuser);
    const op = findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
    const bad = s.post('/tickets/', { type_code: 'expense', title: 'g', parent_id: op.id, payload: {} }, 'k-retry');
    expect(bad.status).toBe(422);
    expect(make(s, op.id, 'k-retry').status).toBe(201);
  });

  it('sin clave, dos POST iguales sí crean dos', () => {
    const s = loginAs(USERS.superuser);
    const op = findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
    const n = total(s);
    s.post('/tickets/', { type_code: 'expense', title: 'g', parent_id: op.id, payload: { concept: 'fuel', amount: 1, currency: 'USD' } });
    s.post('/tickets/', { type_code: 'expense', title: 'g', parent_id: op.id, payload: { concept: 'fuel', amount: 1, currency: 'USD' } });
    expect(total(s)).toBe(n + 2);
  });
});
