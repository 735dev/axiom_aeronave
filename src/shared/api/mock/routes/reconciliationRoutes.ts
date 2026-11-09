import { Ticket } from '@/features/tickets/types/ticket.types';
import { ClosedPeriod, ReconciliationReport } from '@/features/tickets/types/reconciliation.types';
import { currentAuditActor, recordAudit } from '../auditDb';
import { BASE_CURRENCY } from '../money';
import { computeReconciliation } from '../reconciliationCompute';
import { PERIOD_PATTERN, reconciliationState } from '../reconciliationDb';
import { MockResponse, effectivePermissionsFor } from './adminRoutes';
import { ticketState } from './ticketsRoutes';

/** Mismo criterio que la analítica: rechazado o anulado no cuenta como gasto vigente. */
function committed(ticket: Ticket): boolean {
  const type = ticketState.types.find((t) => t.code === ticket.type_code);
  return type?.statuses.find((s) => s.code === ticket.status_code)?.counts_as_committed ?? true;
}

function forbidden(): MockResponse {
  return {
    status: 403,
    data: { title: 'errors.forbiddenTitle', detail: 'errors.forbiddenDetail' },
  };
}

function invalid(
  detail: string,
  codigo?: string,
  extra: Record<string, unknown> = {},
): MockResponse {
  return { status: 422, data: { title: 'errors.validationTitle', detail, codigo, ...extra } };
}

function can(code: string): boolean {
  return effectivePermissionsFor(currentAuditActor().id).includes(code);
}

function buildReport(period: string): ReconciliationReport {
  const report = computeReconciliation({
    period,
    tickets: ticketState.tickets,
    types: ticketState.types,
    committed,
    acknowledgements: reconciliationState.acknowledgements,
    baseCurrency: BASE_CURRENCY,
  });
  return { ...report, close: reconciliationState.closed.get(period) ?? null };
}

function periodOf(source: Record<string, unknown> | URLSearchParams): string | null {
  const raw = source instanceof URLSearchParams ? source.get('period') : source.period;
  const period = String(raw ?? '');
  return PERIOD_PATTERN.test(period) ? period : null;
}

const MIN_NOTE = 5;

function acknowledge(body: Record<string, unknown>): MockResponse {
  if (!can('reconciliation.close')) return forbidden();
  const period = periodOf(body);
  if (!period) return invalid('El período debe tener el formato AAAA-MM.', 'periodo');
  if (reconciliationState.closed.has(period)) {
    return {
      status: 409,
      data: { title: 'errors.conflictTitle', detail: `El período ${period} ya está cerrado.` },
    };
  }
  const key = String(body.key ?? '');
  const note = String(body.note ?? '').trim();
  const diff = buildReport(period).differences.find((d) => d.key === key);
  // Una clave que no es una diferencia vigente no se justifica: no hay nada que aceptar.
  if (!diff) return { status: 404, data: { title: 'errors.notFoundTitle' } };
  if (note.length < MIN_NOTE) {
    return invalid('La justificación es obligatoria.', 'justificacion', {
      errors: { note: 'errors.required' },
    });
  }

  const actor = currentAuditActor();
  const ack = {
    note,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    at: new Date().toISOString(),
  };
  reconciliationState.acknowledgements.set(`${period}|${key}`, ack);
  recordAudit({
    action: 'update',
    entity: 'reconciliation',
    entity_id: period,
    entity_label: `Conciliación ${period}`,
    summary: `Justificó la diferencia ${diff.kind} de ${diff.ticket_code} en ${period}`,
    changes: [{ field: 'justification', label: 'Justificación', from: null, to: note }],
  });
  return { status: 200, data: buildReport(period) };
}

function closePeriod(body: Record<string, unknown>): MockResponse {
  if (!can('reconciliation.close')) return forbidden();
  const period = periodOf(body);
  if (!period) return invalid('El período debe tener el formato AAAA-MM.', 'periodo');
  if (reconciliationState.closed.has(period)) {
    return {
      status: 409,
      data: { title: 'errors.conflictTitle', detail: `El período ${period} ya está cerrado.` },
    };
  }
  // Un mes que no empezó no tiene nada que cerrar: se cerraría vacío y bloquearía altas futuras.
  if (`${period}-01` > new Date().toISOString().slice(0, 10)) {
    return invalid('No se puede cerrar un período futuro.', 'periodo_futuro');
  }

  const report = buildReport(period);
  const open = report.differences.filter((d) => !d.acknowledgement);
  if (open.length > 0) {
    return invalid(
      `No se puede cerrar ${period}: quedan ${open.length} diferencia(s) sin justificar.`,
      'diferencias_abiertas',
      { errors: Object.fromEntries(open.map((d) => [d.key, 'Diferencia sin justificar'])) },
    );
  }

  const actor = currentAuditActor();
  const closed: ClosedPeriod = {
    period,
    closed_at: new Date().toISOString(),
    closed_by_id: actor.id,
    closed_by_name: actor.name,
    closed_by_role: actor.role,
    rows_count: report.rows.length,
    total_base: Math.round(report.rows.reduce((a, r) => a + r.amount_base, 0) * 100) / 100,
    acknowledged_count: report.differences.length,
  };
  reconciliationState.closed.set(period, closed);
  recordAudit({
    action: 'update',
    entity: 'reconciliation',
    entity_id: period,
    entity_label: `Conciliación ${period}`,
    summary: `Cerró el período ${period} (${closed.rows_count} gasto(s), ${closed.acknowledged_count} diferencia(s) justificada(s))`,
    changes: [{ field: 'period_status', label: 'Período', from: 'abierto', to: 'cerrado' }],
  });
  return { status: 200, data: { ...report, close: closed } };
}

/** El archivo lo arma el cliente; el servidor solo deja constancia de quién se llevó qué. */
function recordExport(body: Record<string, unknown>): MockResponse {
  if (!can('analytics.view')) return forbidden();
  const period = periodOf(body);
  if (!period) return invalid('El período debe tener el formato AAAA-MM.', 'periodo');
  const report = buildReport(period);
  recordAudit({
    action: 'export',
    entity: 'reconciliation',
    entity_id: period,
    entity_label: `Conciliación ${period}`,
    summary: `Exportó el detalle conciliado de ${period} (${report.rows.length} línea(s))`,
    changes: [{ field: 'rows', label: 'Líneas exportadas', from: null, to: report.rows.length }],
  });
  return { status: 200, data: { period, rows: report.rows.length } };
}

export function routeReconciliation(
  method: string,
  path: string,
  query: URLSearchParams,
  body: Record<string, unknown>,
): MockResponse | null {
  if (!path.startsWith('/reconciliation/')) return null;
  if (method === 'get' && path === '/reconciliation/') {
    if (!can('analytics.view')) return forbidden();
    const period = periodOf(query);
    if (!period) return invalid('El período debe tener el formato AAAA-MM.', 'periodo');
    return { status: 200, data: buildReport(period) };
  }
  if (method === 'get' && path === '/reconciliation/periods/') {
    if (!can('analytics.view')) return forbidden();
    const closed = [...reconciliationState.closed.values()].sort((a, b) =>
      b.period.localeCompare(a.period),
    );
    return { status: 200, data: closed };
  }
  if (method === 'post' && path === '/reconciliation/acknowledgements/') return acknowledge(body);
  if (method === 'post' && path === '/reconciliation/close/') return closePeriod(body);
  if (method === 'post' && path === '/reconciliation/export/') return recordExport(body);
  return null;
}
