import { Ticket, TicketType } from '@/features/tickets/types/ticket.types';
import {
  Acknowledgement,
  Difference,
  DifferenceKind,
  ReconciliationReport,
  ReconciliationRow,
} from '@/features/tickets/types/reconciliation.types';
import { fieldWithRole } from './money';
import { accountingDate, periodOfDate } from './reconciliationDb';

/** Tolerancia de monto: el centavo. Más que eso ya es una diferencia real. */
export const AMOUNT_TOLERANCE = 0.01;

const round2 = (n: number) => Math.round(n * 100) / 100;

function sameAmount(a: number, b: number): boolean {
  return Math.abs(round2(a - b)) <= AMOUNT_TOLERANCE;
}

interface Receipt {
  file_id: string;
  file_name: string;
  amount: number;
  currency: string;
}

/**
 * Importe leído de un comprobante VALIDADO. Uno solo leído (sin validar) no
 * cuenta: hasta que una persona responde por él es una propuesta, no soporte.
 */
function validatedReceipts(ticket: Ticket, type: TicketType): Receipt[] {
  const amountKey = fieldWithRole(type, 'amount')?.key;
  const currencyKey = fieldWithRole(type, 'currency')?.key;
  if (!amountKey) return [];
  const out: Receipt[] = [];
  ticket.files.forEach((file) => {
    if (file.extraction?.status !== 'validated') return;
    const rawAmount = file.extraction.fields.find((f) => f.key === amountKey)?.value;
    const amount = Number(rawAmount);
    if (rawAmount === undefined || rawAmount === '' || !Number.isFinite(amount)) return;
    const currency = currencyKey
      ? file.extraction.fields.find((f) => f.key === currencyKey)?.value
      : undefined;
    out.push({
      file_id: file.id,
      file_name: file.name,
      amount,
      currency: String(currency ?? ticket.money?.currency ?? ''),
    });
  });
  return out;
}

export interface ComputeInput {
  period: string;
  tickets: Ticket[];
  types: TicketType[];
  committed: (ticket: Ticket) => boolean;
  acknowledgements: Map<string, Acknowledgement>;
  baseCurrency: string;
}

/** Último día del mes, `YYYY-MM-DD`. */
function monthBounds(period: string): { from: string; to: string } {
  const [y, m] = period.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, '0')}` };
}

/**
 * Cruza gastos y comprobantes de un mes y devuelve las tres diferencias del
 * alcance: gasto sin soporte, soporte sin gasto y monto que no coincide.
 */
export function computeReconciliation(input: ComputeInput): ReconciliationReport {
  const { period, tickets, types, acknowledgements } = input;
  const typeOf = (code: string) => types.find((t) => t.code === code);
  const bounds = monthBounds(period);

  const withMoney = tickets.filter((t) => t.money);
  const inPeriod = withMoney.filter(
    (t) => periodOfDate(accountingDate(t, typeOf(t.type_code))) === period,
  );

  // Los gastos vigentes de CADA operación (de cualquier mes): un comprobante
  // cargado en una operación puede corresponder a un gasto de otro mes.
  const activeByOperation = (operationId: string | undefined, own: Ticket) =>
    withMoney.filter(
      (t) => input.committed(t) && (operationId ? t.parent_id === operationId : t.id === own.id),
    );

  const differences: Difference[] = [];
  const kindsByTicket = new Map<string, Set<DifferenceKind>>();
  const receiptByTicket = new Map<string, Receipt>();

  const push = (ticket: Ticket, diff: Omit<Difference, 'key' | 'ticket_id' | 'ticket_code'>) => {
    const key = `${diff.kind}:${ticket.id}:${diff.file_id ?? ''}`;
    differences.push({
      ...diff,
      key,
      ticket_id: ticket.id,
      ticket_code: ticket.code,
      operation_code: ticket.parent_code,
      acknowledgement: acknowledgements.get(`${period}|${key}`),
    });
    const set = kindsByTicket.get(ticket.id) ?? new Set<DifferenceKind>();
    set.add(diff.kind);
    kindsByTicket.set(ticket.id, set);
  };

  inPeriod.forEach((ticket) => {
    const type = typeOf(ticket.type_code);
    if (!type || !ticket.money) return;
    const money = ticket.money;
    const receipts = validatedReceipts(ticket, type);
    if (receipts[0]) receiptByTicket.set(ticket.id, receipts[0]);

    // Un gasto descartado no está pendiente de comprobante, pero si tiene un
    // soporte validado, ese soporte quedó sin gasto vigente.
    if (!input.committed(ticket)) {
      receipts.forEach((r) =>
        push(ticket, {
          kind: 'support_without_expense',
          severity: 'medium',
          reason: 'discarded_expense',
          file_id: r.file_id,
          file_name: r.file_name,
          expense_amount: money.amount,
          expense_currency: money.currency,
          receipt_amount: r.amount,
          receipt_currency: r.currency,
        }),
      );
      return;
    }

    if (ticket.files.length === 0) {
      push(ticket, {
        kind: 'expense_without_support',
        severity: 'high',
        reason: 'no_files',
        expense_amount: money.amount,
        expense_currency: money.currency,
      });
    } else if (receipts.length === 0 && ticket.files.some((f) => f.extraction)) {
      // Hay comprobante pero nadie respondió por lo que se leyó: aún no es soporte.
      push(ticket, {
        kind: 'expense_without_support',
        severity: 'medium',
        reason: 'unvalidated',
        expense_amount: money.amount,
        expense_currency: money.currency,
      });
    }

    const siblings = activeByOperation(ticket.parent_id, ticket);
    receipts.forEach((r) => {
      const base = {
        file_id: r.file_id,
        file_name: r.file_name,
        expense_amount: money.amount,
        expense_currency: money.currency,
        receipt_amount: r.amount,
        receipt_currency: r.currency,
      };
      if (r.currency !== money.currency) {
        push(ticket, { ...base, kind: 'amount_mismatch', severity: 'medium', reason: 'currency' });
      } else if (!sameAmount(r.amount, money.amount)) {
        const gap = Math.abs(r.amount - money.amount) / Math.max(money.amount, AMOUNT_TOLERANCE);
        push(ticket, {
          ...base,
          kind: 'amount_mismatch',
          severity: gap >= 0.1 ? 'high' : 'medium',
          reason: 'amount',
        });
      }
      const matchesSome = siblings.some(
        (e) => e.money && e.money.currency === r.currency && sameAmount(e.money.amount, r.amount),
      );
      if (!matchesSome) {
        push(ticket, {
          ...base,
          kind: 'support_without_expense',
          severity: 'medium',
          reason: 'no_matching_expense',
        });
      }
    });
  });

  const rows: ReconciliationRow[] = inPeriod.map((ticket) => {
    const type = typeOf(ticket.type_code);
    const money = ticket.money!;
    const kinds = [...(kindsByTicket.get(ticket.id) ?? [])];
    const receipt = receiptByTicket.get(ticket.id);
    const notes = differences
      .filter((d) => d.ticket_id === ticket.id && d.acknowledgement)
      .map((d) => d.acknowledgement!.note);
    const conceptKey = type ? fieldWithRole(type, 'item')?.key : undefined;
    const state: ReconciliationRow['state'] =
      kinds.length > 0 ? 'difference' : input.committed(ticket) ? 'reconciled' : 'discarded';
    return {
      ticket_id: ticket.id,
      code: ticket.code,
      operation_code: ticket.parent_code ?? '',
      title: ticket.title,
      concept: conceptKey ? String(ticket.payload[conceptKey] ?? '') : '',
      date: accountingDate(ticket, type),
      status_name: ticket.status_name,
      amount: money.amount,
      currency: money.currency,
      amount_base: money.amount_base,
      base_currency: money.base_currency,
      validated_receipts: validatedReceipts(ticket, type!).length,
      receipt_amount: receipt?.amount,
      receipt_currency: receipt?.currency,
      state,
      difference_kinds: kinds,
      justification: notes.length > 0 ? notes.join(' | ') : undefined,
    };
  });

  const sum = (state: ReconciliationRow['state']) =>
    round2(rows.filter((r) => r.state === state).reduce((a, r) => a + r.amount_base, 0));

  return {
    period,
    ...bounds,
    base_currency: input.baseCurrency,
    rows,
    differences,
    open_differences: differences.filter((d) => !d.acknowledgement).length,
    totals: {
      reconciled_base: sum('reconciled'),
      difference_base: sum('difference'),
      discarded_base: sum('discarded'),
    },
    close: null,
  };
}
