import { BusinessRule, RuleHit, Ticket, TicketType } from '@/features/tickets/types/ticket.types';
import { fieldWithRole } from './money';
import { recordAudit } from './auditDb';

/**
 * Reglas de negocio declaradas por el administrador.
 *
 * Lo que hoy decide una persona al revisar un gasto pasa a ser una condición
 * escrita, que siempre se aplica igual y deja constancia de por qué se disparó.
 */
export const ruleState: { rules: BusinessRule[] } = {
  rules: [
    {
      id: 'r-1',
      name: 'Gasto mayor a 500 USD requiere autorización',
      type_code: 'expense',
      field: 'amount_base',
      operator: 'gt',
      value: 500,
      action: 'require_authorization',
      message: 'Supera el monto autorizado por operación. Requiere visto bueno de la dirección.',
      is_active: true,
    },
    {
      id: 'r-2',
      name: 'Todo gasto debe tener comprobante',
      type_code: 'expense',
      field: 'attachments',
      operator: 'missing',
      action: 'require_support',
      message: 'El gasto no tiene comprobante adjunto.',
      is_active: true,
    },
    {
      id: 'r-4',
      name: 'Gasto fuera de rango para la ruta',
      type_code: 'expense',
      field: 'amount_vs_route',
      operator: 'gt',
      action: 'require_authorization',
      message: 'El importe supera lo habitual para la ruta de esta operación.',
      route_limits: { 'CCS-PZO': 1200, 'CCS-SVSA': 900 },
      is_active: true,
    },
    {
      id: 'r-3',
      name: 'Radioayuda bloquea el despacho',
      type_code: 'expense',
      field: 'concept',
      operator: 'eq',
      value: 'navaid',
      action: 'warn',
      message: 'Sin el pago de radioayuda el INAC no autoriza el vuelo.',
      is_active: true,
    },
  ],
};

function valueOf(rule: BusinessRule, ticket: Ticket, type: TicketType): number | string | undefined {
  if (rule.field === 'amount_base') return ticket.money?.amount_base;
  if (rule.field === 'attachments') return ticket.files.length;
  if (rule.field === 'concept') {
    const field = fieldWithRole(type, 'item');
    return field ? String(ticket.payload[field.key] ?? '') : undefined;
  }
  return undefined;
}

/**
 * Cómo se llega al padre de un ticket. Lo registra el módulo de tickets al
 * cargarse: importarlo desde acá armaría un ciclo y las semillas se evaluarían
 * antes de que existan las reglas.
 */
let findTicket: (id: string | undefined) => Ticket | undefined = () => undefined;
export function setTicketLookup(fn: typeof findTicket) {
  findTicket = fn;
}

/** Ruta de la operación a la que pertenece el gasto: `ORIGEN-DESTINO`. */
function routeOf(ticket: Ticket): string | undefined {
  const parent = findTicket(ticket.parent_id);
  const origin = parent?.payload.origin;
  const destination = parent?.payload.destination;
  return origin && destination ? `${String(origin)}-${String(destination)}` : undefined;
}

function matchesRoute(rule: BusinessRule, ticket: Ticket): boolean {
  const route = routeOf(ticket);
  const limit = route ? rule.route_limits?.[route] : undefined;
  const amount = ticket.money?.amount_base;
  // Sin tope para esa ruta no hay con qué comparar: no se inventa uno.
  return limit !== undefined && amount !== undefined && amount > limit;
}

function matches(rule: BusinessRule, actual: number | string | undefined): boolean {
  if (rule.operator === 'missing') return !actual;
  if (actual === undefined || actual === '') return false;
  if (rule.operator === 'eq') return String(actual) === String(rule.value);
  // Las comparaciones numéricas exigen números de los dos lados: comparar
  // cadenas con > daría un orden alfabético que parece funcionar y no lo hace.
  const a = Number(actual);
  const b = Number(rule.value);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return rule.operator === 'gt' ? a > b : a < b;
}

/** Evalúa las reglas activas del tipo y devuelve las que se disparan. */
export function evaluateRules(ticket: Ticket, type: TicketType): RuleHit[] {
  return ruleState.rules
    .filter((r) => r.is_active && r.type_code === ticket.type_code)
    .filter((r) =>
      r.field === 'amount_vs_route' ? matchesRoute(r, ticket) : matches(r, valueOf(r, ticket, type)),
    )
    .map((r) => ({
      rule_id: r.id,
      rule_name: r.name,
      action: r.action,
      // El mensaje se copia: si la regla se edita después, lo que se avisó
      // en su momento debe seguir diciendo lo mismo.
      message: r.message,
      at: new Date().toISOString(),
    }));
}

/**
 * Evalúa y deja constancia: cada regla que se dispara por primera vez en un
 * ticket queda en la bitácora con su motivo. Lo que ya estaba disparado
 * conserva su fecha original; recalcular no reescribe la historia.
 */
export function applyRules(ticket: Ticket, type: TicketType): RuleHit[] {
  const previous = new Map((ticket.rule_hits ?? []).map((h) => [h.rule_id, h]));
  const hits = evaluateRules(ticket, type).map((h) => previous.get(h.rule_id) ?? h);
  hits
    .filter((h) => !previous.has(h.rule_id))
    .forEach((h) => {
      recordAudit({
        action: 'update',
        entity: 'ticket',
        entity_id: ticket.id,
        entity_label: ticket.code,
        summary: `Se disparó la regla "${h.rule_name}" en ${ticket.code}: ${h.message}`,
      });
    });
  return hits;
}

/** Un gasto con una regla de autorización disparada necesita el visto bueno vigente. */
export function missingAuthorization(ticket: Ticket): boolean {
  const required = (ticket.rule_hits ?? []).some((h) => h.action === 'require_authorization');
  if (!required) return false;
  const auth = ticket.authorization;
  return !auth || auth.amount_base !== (ticket.money?.amount_base ?? 0);
}
