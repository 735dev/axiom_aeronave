import { beforeEach, describe, expect, it } from 'vitest';
import { PNG, USERS, findTicket, loginAs, Session } from '@/test/mockApi';
import { resetReconciliation } from './reconciliationDb';

const admin = () => loginAs(USERS.superuser);

/** Cada prueba usa su propio mes para no cerrarle el período a otra. */
let monthSeq = 0;
function freshMonth(): { period: string; day: string } {
  monthSeq += 1;
  const year = 2000 + Math.floor((monthSeq - 1) / 12);
  const month = String(((monthSeq - 1) % 12) + 1).padStart(2, '0');
  return { period: `${year}-${month}`, day: `${year}-${month}-10` };
}

function operation(s: Session) {
  return findTicket(s, (t) => t.type_code === 'operation' && !t.status_is_final);
}

function expense(s: Session, opId: string, day: string, amount: number, extra = {}) {
  const res = s.post('/tickets/', {
    type_code: 'expense',
    title: `Gasto ${amount}`,
    parent_id: opId,
    payload: { concept: 'fuel', amount, currency: 'USD', expense_date: day, ...extra },
  });
  expect(res.status).toBe(201);
  return res.data;
}

let nameSeq = 0;
/** Sube una imagen cuya lectura salga legible (el mock hace ilegible 1 de cada 7). */
function attach(s: Session, ticketId: string) {
  for (let i = 0; i < 40; i += 1) {
    nameSeq += 1;
    const res = s.post(`/tickets/${ticketId}/attachments/`, {
      name: `recibo-${nameSeq}.png`,
      mime: 'image/png',
      size: 100 + nameSeq,
      data_url: PNG,
    });
    expect(res.status).toBe(201);
    const file = res.data.files[res.data.files.length - 1];
    if (file.extraction?.status === 'extracted') return file;
  }
  throw new Error('no se logró un comprobante legible');
}

/** Comprobante validado con el importe que se indique (el gasto toma ese valor). */
function validatedReceipt(s: Session, ticketId: string, amount: number, currency = 'USD') {
  const file = attach(s, ticketId);
  const res = s.post(`/tickets/${ticketId}/attachments/${file.id}/validate/`, {
    fields: JSON.stringify([
      { key: 'amount', value: amount },
      { key: 'currency', value: currency },
    ]),
  });
  expect(res.status).toBe(200);
  return file;
}

const report = (s: Session, period: string) => s.get('/reconciliation/', { period }).data;
const kinds = (r: any) => r.differences.map((d: any) => d.kind).sort();
const auditOf = (s: Session, action: string) =>
  (s.get('/audit/', { limit: '200', action }).data.data as any[]) ?? [];

beforeEach(() => resetReconciliation());

describe('conciliación: detección de diferencias', () => {
  it('gasto con comprobante validado del mismo monto no genera diferencias', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const e = expense(s, operation(s).id, day, 100);
    validatedReceipt(s, e.id, 100);
    const r = report(s, period);
    expect(r.differences).toEqual([]);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].state).toBe('reconciled');
    expect(r.totals.reconciled_base).toBe(100);
  });

  it('un mes sin gastos no inventa diferencias', () => {
    const s = admin();
    const r = report(s, freshMonth().period);
    expect(r.rows).toEqual([]);
    expect(r.differences).toEqual([]);
  });

  it('gasto sin ningún archivo: gasto sin soporte, severidad alta', () => {
    const s = admin();
    const { period, day } = freshMonth();
    expenseNoFile(s, day);
    const r = report(s, period);
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0]).toMatchObject({
      kind: 'expense_without_support',
      reason: 'no_files',
      severity: 'high',
    });
  });

  it('comprobante leído pero sin validar: gasto sin soporte, severidad media', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const e = expense(s, operation(s).id, day, 100);
    attach(s, e.id);
    const d = report(s, period).differences;
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({
      kind: 'expense_without_support',
      reason: 'unvalidated',
      severity: 'medium',
    });
  });

  it('monto distinto en más de un centavo: monto que no coincide', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const e = expense(s, operation(s).id, day, 100);
    validatedReceipt(s, e.id, 100);
    s.patch(`/tickets/${e.id}/`, { payload: { amount: 100.02 } });
    const d = report(s, period).differences.find((x: any) => x.kind === 'amount_mismatch');
    expect(d).toMatchObject({ reason: 'amount', expense_amount: 100.02, receipt_amount: 100 });
  });

  it('diferencia de exactamente un centavo se tolera', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const e = expense(s, operation(s).id, day, 100);
    validatedReceipt(s, e.id, 100);
    s.patch(`/tickets/${e.id}/`, { payload: { amount: 100.01 } });
    expect(report(s, period).differences).toEqual([]);
  });

  it('severidad: menos de 10% es media y 10% o más es alta', () => {
    const s = admin();
    const a = freshMonth();
    const e1 = expense(s, operation(s).id, a.day, 100);
    validatedReceipt(s, e1.id, 100);
    s.patch(`/tickets/${e1.id}/`, { payload: { amount: 105 } });
    const mid = report(s, a.period).differences.find((x: any) => x.kind === 'amount_mismatch');
    expect(mid.severity).toBe('medium');

    const b = freshMonth();
    const e2 = expense(s, operation(s).id, b.day, 100);
    validatedReceipt(s, e2.id, 100);
    s.patch(`/tickets/${e2.id}/`, { payload: { amount: 150 } });
    const high = report(s, b.period).differences.find((x: any) => x.kind === 'amount_mismatch');
    expect(high.severity).toBe('high');
  });

  it('moneda distinta entre comprobante y gasto: mismatch por moneda', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const e = expense(s, operation(s).id, day, 100);
    validatedReceipt(s, e.id, 100, 'USD');
    const res = s.patch(`/tickets/${e.id}/`, { payload: { currency: 'VES', exchange_rate: 36.5 } });
    expect(res.status).toBe(200);
    const d = report(s, period).differences.find((x: any) => x.kind === 'amount_mismatch');
    expect(d).toMatchObject({
      reason: 'currency',
      receipt_currency: 'USD',
      expense_currency: 'VES',
    });
  });

  it('comprobante cuyo monto no corresponde a ningún gasto de la operación: soporte sin gasto', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const e = expense(s, operation(s).id, day, 137.37);
    validatedReceipt(s, e.id, 137.37);
    s.patch(`/tickets/${e.id}/`, { payload: { amount: 150.5 } });
    const r = report(s, period);
    expect(kinds(r)).toEqual(['amount_mismatch', 'support_without_expense']);
    expect(r.differences.find((d: any) => d.kind === 'support_without_expense').reason).toBe(
      'no_matching_expense',
    );
  });

  it('si otro gasto de la operación tiene ese importe, el comprobante no es huérfano', () => {
    const s = admin();
    const { period, day } = freshMonth();
    // Importe poco común: la operación de ejemplo ya trae gastos de 100.
    const op = operation(s);
    const a = expense(s, op.id, day, 137.37);
    validatedReceipt(s, a.id, 137.37);
    s.patch(`/tickets/${a.id}/`, { payload: { amount: 150.5 } });
    const b = expense(s, op.id, day, 137.37);
    validatedReceipt(s, b.id, 137.37);
    const r = report(s, period);
    expect(r.differences.filter((d: any) => d.kind === 'support_without_expense')).toEqual([]);
    expect(r.differences.filter((d: any) => d.kind === 'amount_mismatch')).toHaveLength(1);
  });

  it('comprobante validado sobre un gasto rechazado: soporte sin gasto vigente', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const e = expense(s, operation(s).id, day, 100);
    validatedReceipt(s, e.id, 100);
    expect(s.patch(`/tickets/${e.id}/`, { status_code: 'rejected' }).status).toBe(200);
    const r = report(s, period);
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0]).toMatchObject({
      kind: 'support_without_expense',
      reason: 'discarded_expense',
    });
    expect(r.rows[0].state).toBe('difference');
  });

  it('un gasto rechazado sin comprobante no es diferencia: queda descartado', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const e = expense(s, operation(s).id, day, 100);
    s.patch(`/tickets/${e.id}/`, { status_code: 'rejected' });
    const r = report(s, period);
    expect(r.differences).toEqual([]);
    expect(r.rows[0].state).toBe('discarded');
    expect(r.totals.discarded_base).toBe(100);
    expect(r.totals.reconciled_base).toBe(0);
  });

  it('el gasto se ubica en el mes de su fecha contable, no en el de carga', () => {
    const s = admin();
    const { period, day } = freshMonth();
    expense(s, operation(s).id, day, 100);
    const other = freshMonth();
    expect(report(s, period).rows).toHaveLength(1);
    expect(report(s, other.period).rows).toHaveLength(0);
  });

  it('cada diferencia trae una clave estable entre consultas', () => {
    const s = admin();
    const { period, day } = freshMonth();
    expenseNoFile(s, day);
    expect(report(s, period).differences[0].key).toBe(report(s, period).differences[0].key);
  });
});

function expenseNoFile(s: Session, day: string) {
  return expense(s, operation(s).id, day, 100);
}

describe('conciliación: cierre de período', () => {
  it('no se puede cerrar con diferencias sin justificar', () => {
    const s = admin();
    const { period, day } = freshMonth();
    expenseNoFile(s, day);
    const res = s.post('/reconciliation/close/', { period });
    expect(res.status).toBe(422);
    expect(res.data.codigo).toBe('diferencias_abiertas');
    expect(Object.keys(res.data.errors)).toHaveLength(1);
    expect(report(s, period).close).toBeNull();
  });

  it('justificar con nota corta se rechaza', () => {
    const s = admin();
    const { period, day } = freshMonth();
    expenseNoFile(s, day);
    const key = report(s, period).differences[0].key;
    expect(s.post('/reconciliation/acknowledgements/', { period, key, note: 'ok' }).status).toBe(
      422,
    );
    expect(report(s, period).open_differences).toBe(1);
  });

  it('justificar una clave que no es diferencia da 404', () => {
    const s = admin();
    const { period, day } = freshMonth();
    expenseNoFile(s, day);
    const res = s.post('/reconciliation/acknowledgements/', {
      period,
      key: 'x:y:z',
      note: 'nota larga',
    });
    expect(res.status).toBe(404);
  });

  it('con cada diferencia justificada se puede cerrar y queda quién y cuándo', () => {
    const s = admin();
    const { period, day } = freshMonth();
    expenseNoFile(s, day);
    const key = report(s, period).differences[0].key;
    const ack = s.post('/reconciliation/acknowledgements/', {
      period,
      key,
      note: 'Se entrega mañana',
    });
    expect(ack.status).toBe(200);
    const d = ack.data.differences[0];
    expect(d.acknowledgement.note).toBe('Se entrega mañana');
    expect(d.acknowledgement.actor_name).toBe(s.user.full_name);
    expect(ack.data.open_differences).toBe(0);

    const res = s.post('/reconciliation/close/', { period });
    expect(res.status).toBe(200);
    expect(res.data.close).toMatchObject({
      period,
      closed_by_name: s.user.full_name,
      rows_count: 1,
      acknowledged_count: 1,
    });
    expect(new Date(res.data.close.closed_at).getTime()).not.toBeNaN();
    expect(report(s, period).close.closed_by_id).toBe(s.user.id);
  });

  it('un período sin diferencias se cierra directo', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const e = expense(s, operation(s).id, day, 100);
    validatedReceipt(s, e.id, 100);
    expect(s.post('/reconciliation/close/', { period }).status).toBe(200);
  });

  it('un período cerrado no se reabre ni se cierra dos veces', () => {
    const s = admin();
    const { period } = freshMonth();
    expect(s.post('/reconciliation/close/', { period }).status).toBe(200);
    expect(s.post('/reconciliation/close/', { period }).status).toBe(409);
    expect(s.del(`/reconciliation/${period}/`).status).toBe(404);
    expect(report(s, period).close).not.toBeNull();
  });

  it('no se puede justificar en un período ya cerrado', () => {
    const s = admin();
    const { period } = freshMonth();
    s.post('/reconciliation/close/', { period });
    const res = s.post('/reconciliation/acknowledgements/', {
      period,
      key: 'a',
      note: 'nota larga',
    });
    expect(res.status).toBe(409);
  });

  it('un período futuro no se cierra', () => {
    const s = admin();
    expect(s.post('/reconciliation/close/', { period: '2999-01' }).status).toBe(422);
  });

  it('un período con formato inválido da 422', () => {
    const s = admin();
    expect(s.post('/reconciliation/close/', { period: '2020-13' }).status).toBe(422);
    expect(s.get('/reconciliation/', { period: 'junio' }).status).toBe(422);
  });

  it('sin el permiso de cierre responde 403 y no cierra nada', () => {
    const ops = loginAs(USERS.operations);
    const { period } = freshMonth();
    expect(ops.post('/reconciliation/close/', { period }).status).toBe(403);
    expect(report(ops, period).close).toBeNull();
  });

  it('sin permiso de analítica ni siquiera se consulta', () => {
    const pilot = loginAs(USERS.pilot);
    expect(pilot.get('/reconciliation/', { period: freshMonth().period }).status).toBe(403);
  });

  it('cerrar queda en la bitácora con el período y el actor', () => {
    const s = admin();
    const { period } = freshMonth();
    s.post('/reconciliation/close/', { period });
    const ev = (
      s.get('/audit/', { limit: '50', entity: 'reconciliation' }).data.data as any[]
    ).find((e) => e.entity_id === period && e.summary.includes('Cerró'));
    expect(ev).toBeDefined();
    expect(ev.action).toBe('update');
    expect(ev.actor_id).toBe(s.user.id);
  });

  it('cerrar con diferencias bloqueadas no deja evento de cierre', () => {
    const s = admin();
    const { period, day } = freshMonth();
    expenseNoFile(s, day);
    s.post('/reconciliation/close/', { period });
    const closes = (
      s.get('/audit/', { limit: '100', entity: 'reconciliation' }).data.data as any[]
    ).filter((e) => e.entity_id === period && e.summary.includes('Cerró'));
    expect(closes).toEqual([]);
  });

  it('justificar queda en la bitácora con la nota', () => {
    const s = admin();
    const { period, day } = freshMonth();
    expenseNoFile(s, day);
    const key = report(s, period).differences[0].key;
    s.post('/reconciliation/acknowledgements/', { period, key, note: 'Motivo auditable' });
    const ev = (
      s.get('/audit/', { limit: '50', entity: 'reconciliation' }).data.data as any[]
    ).find((e) => e.entity_id === period && e.summary.includes('Justificó'));
    expect(ev.changes[0].to).toBe('Motivo auditable');
  });
});

describe('conciliación: inmutabilidad tras el cierre', () => {
  function closedWithExpense() {
    const s = admin();
    const { period, day } = freshMonth();
    const op = operation(s);
    const e = expense(s, op.id, day, 100);
    const file = validatedReceipt(s, e.id, 100);
    expect(s.post('/reconciliation/close/', { period }).status).toBe(200);
    return { s, period, day, op, e, file };
  }

  it('editar un gasto del período cerrado devuelve 409 y no cambia nada', () => {
    const { s, e } = closedWithExpense();
    expect(s.patch(`/tickets/${e.id}/`, { payload: { amount: 999 } }).status).toBe(409);
    expect(s.get(`/tickets/${e.id}/`).data.money.amount).toBe(100);
  });

  it('cambiar el estado de un gasto cerrado también es 409', () => {
    const { s, e } = closedWithExpense();
    expect(s.patch(`/tickets/${e.id}/`, { status_code: 'rejected' }).status).toBe(409);
  });

  it('el intento rechazado queda como denied en la bitácora', () => {
    const { s, e } = closedWithExpense();
    s.patch(`/tickets/${e.id}/`, { payload: { amount: 999 } });
    const denied = auditOf(s, 'denied').find((x) => x.entity_id === e.id);
    expect(denied?.summary).toContain('cerrado');
  });

  it('adjuntar un archivo a un gasto del período cerrado es 409', () => {
    const { s, e } = closedWithExpense();
    const before = s.get(`/tickets/${e.id}/`).data.files.length;
    const res = s.post(`/tickets/${e.id}/attachments/`, {
      name: 'tarde.png',
      mime: 'image/png',
      size: 9,
      data_url: PNG,
    });
    expect(res.status).toBe(409);
    expect(s.get(`/tickets/${e.id}/`).data.files).toHaveLength(before);
  });

  it('validar un comprobante pendiente en un período cerrado es 409', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const e = expense(s, operation(s).id, day, 100);
    const file = attach(s, e.id);
    // Se cierra justificando que el comprobante sigue sin validar.
    const key = report(s, period).differences[0].key;
    s.post('/reconciliation/acknowledgements/', { period, key, note: 'Pendiente de validar' });
    expect(s.post('/reconciliation/close/', { period }).status).toBe(200);
    const res = s.post(`/tickets/${e.id}/attachments/${file.id}/validate/`, {
      fields: JSON.stringify([{ key: 'amount', value: 100 }]),
    });
    expect(res.status).toBe(409);
  });

  it('registrar un gasto nuevo con fecha en el mes cerrado es 409', () => {
    const { s, op, day } = closedWithExpense();
    const res = s.post('/tickets/', {
      type_code: 'expense',
      title: 'Colado',
      parent_id: op.id,
      payload: { concept: 'fuel', amount: 5, currency: 'USD', expense_date: day },
    });
    expect(res.status).toBe(409);
    expect(res.data.codigo).toBe('periodo_cerrado');
  });

  it('mover un gasto abierto a una fecha del mes cerrado es 409', () => {
    const { s, op, day } = closedWithExpense();
    const open = expense(s, op.id, freshMonth().day, 50);
    expect(s.patch(`/tickets/${open.id}/`, { payload: { expense_date: day } }).status).toBe(409);
    expect(s.get(`/tickets/${open.id}/`).data.payload.expense_date).not.toBe(day);
  });

  it('un gasto de otro mes sigue editable: el candado es del período, no global', () => {
    const { s, op } = closedWithExpense();
    const open = expense(s, op.id, freshMonth().day, 50);
    expect(s.patch(`/tickets/${open.id}/`, { title: 'sigue editable' }).status).toBe(200);
  });

  it('el reporte del período cerrado no cambia tras el intento de edición', () => {
    const { s, period, e } = closedWithExpense();
    const before = report(s, period);
    s.patch(`/tickets/${e.id}/`, { payload: { amount: 999 } });
    expect(report(s, period).rows).toEqual(before.rows);
  });
});

describe('conciliación: exportación', () => {
  it('exportar deja un evento export con la cantidad de líneas', () => {
    const s = admin();
    const { period, day } = freshMonth();
    expenseNoFile(s, day);
    const res = s.post('/reconciliation/export/', { period });
    expect(res.status).toBe(200);
    expect(res.data.rows).toBe(1);
    const ev = auditOf(s, 'export').find(
      (e) => e.entity === 'reconciliation' && e.entity_id === period,
    );
    expect(ev?.changes[0].to).toBe(1);
    expect(ev?.actor_id).toBe(s.user.id);
  });

  it('sin permiso no se exporta ni queda evento', () => {
    const pilot = loginAs(USERS.pilot);
    const { period } = freshMonth();
    expect(pilot.post('/reconciliation/export/', { period }).status).toBe(403);
    const admins = admin();
    expect(
      auditOf(admins, 'export').find(
        (e) => e.entity === 'reconciliation' && e.entity_id === period,
      ),
    ).toBeUndefined();
  });

  it('el detalle trae lo necesario para el CSV: operación, concepto y fecha', () => {
    const s = admin();
    const { period, day } = freshMonth();
    const op = operation(s);
    expense(s, op.id, day, 100);
    const row = report(s, period).rows[0];
    expect(row).toMatchObject({
      operation_code: op.code,
      concept: 'fuel',
      date: day,
      currency: 'USD',
    });
  });
});
