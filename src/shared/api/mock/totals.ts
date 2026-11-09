import { ExpenseTotals, MoneyTotal, Ticket, TicketType } from '@/features/tickets/types/ticket.types';
import { BASE_CURRENCY, fieldWithRole } from './money';
import { adminState } from './routes/adminRoutes';

export function conceptLabel(type: TicketType | undefined, ticket: Ticket): { key: string; label: string } {
  const field = type ? fieldWithRole(type, 'item') : undefined;
  if (!field) return { key: ticket.type_code, label: ticket.type_name };
  const raw = ticket.payload[field.key];
  if (raw === undefined || raw === null || raw === '') {
    return { key: '__sin__', label: 'Sin clasificar' };
  }
  const code = String(raw);
  const item = field.catalog
    ? adminState.catalog.find((i) => i.catalog === field.catalog && i.code === code)
    : undefined;
  return { key: code, label: item?.name ?? code };
}

/**
 * Totaliza una lista de tickets ya filtrada.
 *
 * Separa tres bolsas porque mezclarlas da un número que nadie puede defender:
 * lo confirmado (estado final que cuenta), lo comprometido pero aún en curso,
 * y lo excluido (rechazado o anulado), que se reporta para que se vea que
 * existe en vez de desaparecer del cuadro.
 */
export function computeTotals(
  tickets: Ticket[],
  typeOf: (code: string) => TicketType | undefined,
): ExpenseTotals {
  let committed = 0;
  let pending = 0;
  let excluded = 0;

  const byCurrency = new Map<string, MoneyTotal>();
  const byConcept = new Map<string, { key: string; label: string; amount_base: number; count: number }>();

  tickets.forEach((ticket) => {
    if (!ticket.money) return;
    const type = typeOf(ticket.type_code);
    const status = type?.statuses.find((s) => s.code === ticket.status_code);
    const counts = status?.counts_as_committed ?? true;

    if (!counts) {
      excluded += ticket.money.amount_base;
      return;
    }
    if (ticket.status_is_final) committed += ticket.money.amount_base;
    else pending += ticket.money.amount_base;

    const currency = byCurrency.get(ticket.money.currency) ?? {
      currency: ticket.money.currency,
      currency_name: ticket.money.currency_name,
      amount: 0,
      amount_base: 0,
      count: 0,
    };
    currency.amount += ticket.money.amount;
    currency.amount_base += ticket.money.amount_base;
    currency.count += 1;
    byCurrency.set(ticket.money.currency, currency);

    const { key, label } = conceptLabel(type, ticket);
    const concept = byConcept.get(key) ?? { key, label, amount_base: 0, count: 0 };
    concept.amount_base += ticket.money.amount_base;
    concept.count += 1;
    byConcept.set(key, concept);
  });

  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    base_currency: BASE_CURRENCY,
    committed_base: round(committed),
    pending_base: round(pending),
    excluded_base: round(excluded),
    by_currency: [...byCurrency.values()].map((c) => ({
      ...c,
      amount: round(c.amount),
      amount_base: round(c.amount_base),
    })),
    by_concept: [...byConcept.values()]
      .map((c) => ({ ...c, amount_base: round(c.amount_base) }))
      .sort((a, b) => b.amount_base - a.amount_base),
  };
}
