import { Ticket, TicketType } from '@/features/tickets/types/ticket.types';
import { Acknowledgement, ClosedPeriod } from '@/features/tickets/types/reconciliation.types';
import { recordAudit } from './auditDb';

interface MockResponse {
  status: number;
  data: unknown;
}

/**
 * Estado de la conciliación. Vive aparte de las rutas para que el candado de
 * período lo pueda importar `ticketsRoutes` sin crear un ciclo de módulos.
 */
export const reconciliationState = {
  /** Períodos cerrados, por `YYYY-MM`. Un cierre no se reabre. */
  closed: new Map<string, ClosedPeriod>(),
  /** Justificaciones por `período|clave de diferencia`. */
  acknowledgements: new Map<string, Acknowledgement>(),
};

export function resetReconciliation() {
  reconciliationState.closed.clear();
  reconciliationState.acknowledgements.clear();
}

export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Fecha contable del ticket: la del tipo si la define, si no la de creación. */
export function accountingDate(ticket: Ticket, type?: TicketType): string {
  const dateField = type?.fields.find((f) => f.role === 'accounting_date');
  const raw = dateField ? ticket.payload[dateField.key] : undefined;
  // El formulario envía cadena vacía con el campo sin llenar: `??` no alcanza.
  const hasDate = raw !== undefined && raw !== null && raw !== '';
  return String(hasDate ? raw : ticket.created_at).slice(0, 10);
}

/** Solo los tipos con importe se concilian y, por tanto, se congelan al cerrar. */
function hasAmount(type?: TicketType): boolean {
  return Boolean(type?.fields.some((f) => f.role === 'amount'));
}

export function periodOfDate(date: string): string {
  return date.slice(0, 7);
}

function denied(
  entityId: string,
  entityLabel: string,
  period: string,
  attempt: string,
): MockResponse {
  // Un intento rechazado también es un hecho que la bitácora debe poder probar.
  recordAudit({
    action: 'denied',
    entity: 'ticket',
    entity_id: entityId,
    entity_label: entityLabel,
    summary: `Intento de ${attempt} ${entityLabel}, cuyo período ${period} está cerrado`,
  });
  return {
    status: 409,
    data: {
      title: 'errors.conflictTitle',
      detail: `El período ${period} está cerrado: ${entityLabel} no admite cambios.`,
      codigo: 'periodo_cerrado',
    },
  };
}

/** 409 si el gasto pertenece a un período ya cerrado. */
export function periodLockedResponse(
  ticket: Ticket,
  type: TicketType | undefined,
  attempt = 'modificar',
): MockResponse | undefined {
  if (!hasAmount(type)) return undefined;
  const period = periodOfDate(accountingDate(ticket, type));
  if (!reconciliationState.closed.has(period)) return undefined;
  return denied(ticket.id, ticket.code, period, attempt);
}

/**
 * Igual, pero para un gasto que todavía no existe o cuya fecha se está
 * moviendo: sin esto se podría colar un gasto nuevo en un mes ya cerrado, o
 * mover uno abierto adentro, y el cierre dejaría de ser lo que se firmó.
 */
export function periodLockedForPayload(
  type: TicketType,
  payload: Record<string, unknown>,
  context: { id: string; label: string },
  attempt = 'registrar un gasto en',
  /** Fecha a usar si el payload no trae ninguna (alta: cae en la fecha de hoy). */
  defaultDate?: string,
): MockResponse | undefined {
  if (!hasAmount(type)) return undefined;
  const dateField = type.fields.find((f) => f.role === 'accounting_date');
  const raw = dateField ? payload[dateField.key] : undefined;
  const empty = raw === undefined || raw === null || raw === '';
  if (empty && !defaultDate) return undefined;
  const period = periodOfDate(String(empty ? defaultDate : raw));
  if (!reconciliationState.closed.has(period)) return undefined;
  return denied(context.id, context.label, period, attempt);
}
