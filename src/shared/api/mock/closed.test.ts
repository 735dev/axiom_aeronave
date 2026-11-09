import { describe, expect, it } from 'vitest';
import { PNG, USERS, findTicket, loginAs, newExpense } from '@/test/mockApi';

const s = () => loginAs(USERS.superuser);

/** Lleva un gasto a un estado final cerrando por el camino que el tipo define. */
function closedExpense(sess = s()) {
  const op = findTicket(sess, (t) => t.type_code === 'operation' && !t.status_is_final);
  const exp = newExpense(sess, op.id).data;
  const res = sess.patch(`/tickets/${exp.id}/`, { status_code: 'verified' });
  return { sess, exp, res, op };
}

describe('expediente cerrado es inmutable', () => {
  it('el cierre responde 200', () => {
    expect(closedExpense().res.status).toBe(200);
  });

  it('PATCH devuelve 409', () => {
    const { sess, exp } = closedExpense();
    expect(sess.patch(`/tickets/${exp.id}/`, { title: 'cambio' }).status).toBe(409);
  });

  it('adjuntar devuelve 409 y no archiva nada', () => {
    const { sess, exp } = closedExpense();
    const r = sess.post(`/tickets/${exp.id}/attachments/`, { name: 'a.png', mime: 'image/png', size: 9, data_url: PNG });
    expect(r.status).toBe(409);
    expect(sess.get(`/tickets/${exp.id}/`).data.files).toHaveLength(0);
  });

  it('el título no cambió tras el intento', () => {
    const { sess, exp } = closedExpense();
    sess.patch(`/tickets/${exp.id}/`, { title: 'cambio' });
    expect(sess.get(`/tickets/${exp.id}/`).data.title).toBe('Gasto de prueba');
  });

  it('el intento rechazado queda en la bitácora como denied', () => {
    const { sess, exp } = closedExpense();
    sess.patch(`/tickets/${exp.id}/`, { title: 'cambio' });
    const audit = sess.get('/audit/', { limit: '50' });
    const events = audit.data.data ?? audit.data;
    expect(events.some((e: any) => e.action === 'denied' && e.entity_id === exp.id)).toBe(true);
  });

  it('un abierto sigue editable (el candado no es global)', () => {
    const sess = s();
    const op = findTicket(sess, (t) => t.type_code === 'operation' && !t.status_is_final);
    const exp = newExpense(sess, op.id).data;
    expect(sess.patch(`/tickets/${exp.id}/`, { title: 'ok' }).status).toBe(200);
  });
});
