import { FieldDef, Ticket, TicketMoney, TicketType } from '@/features/tickets/types/ticket.types';
import { adminState } from './routes/adminRoutes';

/** Moneda en la que se expresan todos los totales. */
export const BASE_CURRENCY = 'USD';

export function fieldWithRole(type: TicketType, role: FieldDef['role']): FieldDef | undefined {
  return type.fields.find((f) => f.role === role);
}

function currencyName(code: string): string {
  const item = adminState.catalog.find((i) => i.catalog === 'currencies' && i.code === code);
  return item?.name ?? code;
}

function toNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export interface MoneyResult {
  money?: TicketMoney;
  /** Motivo por el que no se pudo valorizar. Bloquea el registro. */
  error?: string;
}

/**
 * Calcula el importe de un ticket y CONGELA la tasa usada.
 *
 * La tasa sale de la operación padre (`exchange_rate`, en Bs por dólar), que
 * es la del día del vuelo. Si el gasto no está en la moneda base y no hay
 * tasa, se rechaza: convertir con una tasa inventada produce un total que
 * parece correcto y no lo es.
 */
export function resolveMoney(
  type: TicketType,
  payload: Record<string, unknown>,
  parent?: Ticket,
  previous?: TicketMoney,
): MoneyResult {
  const amountField = fieldWithRole(type, 'amount');
  if (!amountField) return {};

  const amount = toNumber(payload[amountField.key]);
  if (amount === undefined) return {};

  // La tasa se congela al registrar: editar una nota no puede revalorizar un
  // gasto viejo con la tasa de hoy. Solo cambia si cambió el importe, la
  // moneda o la tasa que se escribió a mano.
  const currencyKey = fieldWithRole(type, 'currency');
  const sameCurrency =
    previous?.currency ===
    (currencyKey ? String(payload[currencyKey.key] ?? BASE_CURRENCY) : BASE_CURRENCY);
  const manual = toNumber(payload.exchange_rate);
  const sameRate =
    previous?.rate_source !== 'manual' ||
    (manual !== undefined && Math.abs(1 / manual - previous.rate) < 1e-9);
  if (previous && previous.amount === amount && sameCurrency && sameRate)
    return { money: previous };

  const currencyField = fieldWithRole(type, 'currency');
  const currency = currencyField
    ? String(payload[currencyField.key] ?? BASE_CURRENCY)
    : BASE_CURRENCY;

  if (currency === BASE_CURRENCY) {
    return {
      money: {
        amount,
        currency,
        currency_name: currencyName(currency),
        rate: 1,
        amount_base: amount,
        base_currency: BASE_CURRENCY,
        rated_at: new Date().toISOString(),
        rate_source: 'base',
      },
    };
  }

  const parentRate = toNumber(parent?.payload?.exchange_rate);
  const manualRate = toNumber(payload.exchange_rate);
  const perBase = manualRate ?? parentRate;

  if (!perBase || perBase <= 0) {
    return {
      error:
        `Falta la tasa del día para convertir ${currency} a ${BASE_CURRENCY}. ` +
        'Cárgala en la operación o en el gasto.',
    };
  }

  // `exchange_rate` viene en moneda local por dólar; `rate` es su inverso.
  const rate = 1 / perBase;
  return {
    money: {
      amount,
      currency,
      currency_name: currencyName(currency),
      rate,
      amount_base: Math.round(amount * rate * 100) / 100,
      base_currency: BASE_CURRENCY,
      rated_at: new Date().toISOString(),
      rate_source: manualRate ? 'manual' : 'operation',
    },
  };
}
