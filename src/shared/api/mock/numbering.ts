import { Ticket, TicketType } from '@/features/tickets/types/ticket.types';
import { fieldWithRole } from './money';

/**
 * Numera los expedientes como los nombra la operación: matrícula, correlativo
 * y año — `YV2323-001-26`.
 *
 * El correlativo es por aeronave y por año, no global: en enero cada avión
 * vuelve a empezar en 001. Es como se referencian los vuelos entre ellos, y
 * un número corrido global no diría nada.
 */
export function buildOperationCode(
  type: TicketType,
  payload: Record<string, unknown>,
  existing: Ticket[],
): string | null {
  const aircraftField = fieldWithRole(type, 'aircraft');
  if (!aircraftField) return null;

  const registration = String(payload[aircraftField.key] ?? '').trim().toUpperCase();
  if (!registration) return null;

  const dateField = fieldWithRole(type, 'accounting_date');
  const rawDate = dateField ? payload[dateField.key] : undefined;
  const date = rawDate ? new Date(String(rawDate)) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date() : date;
  const yy = String(year.getFullYear()).slice(-2);

  const prefix = `${registration}-`;
  const suffix = `-${yy}`;

  // El correlativo sale del mayor número ya usado, no de la cantidad de
  // expedientes: si se anula uno, contar daría un número repetido.
  const highest = existing
    .filter((t) => t.type_code === type.code && t.code.startsWith(prefix) && t.code.endsWith(suffix))
    .reduce((max, t) => {
      const middle = t.code.slice(prefix.length, t.code.length - suffix.length);
      const n = Number(middle);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);

  return `${prefix}${String(highest + 1).padStart(3, '0')}${suffix}`;
}
