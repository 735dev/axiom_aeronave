import { AuditEvent } from '@/features/audit/types/audit.types';
import { auditState } from '../auditDb';

export interface MockResponse {
  status: number;
  data: unknown;
}

function matchesSearch(event: AuditEvent, term: string): boolean {
  const haystack = [
    event.summary,
    event.entity_label,
    event.actor_name,
    event.actor_role,
    ...event.changes.map((c) => c.label),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

function applyFilters(query: URLSearchParams): AuditEvent[] {
  const entity = query.get('entity');
  const entityId = query.get('entity_id');
  const action = query.get('action');
  const actorId = query.get('actor_id');
  const from = query.get('from');
  const to = query.get('to');
  const search = query.get('search')?.trim().toLowerCase();

  return auditState.events.filter((event) => {
    if (entity && event.entity !== entity) return false;
    if (entityId && event.entity_id !== entityId) return false;
    if (action && event.action !== action) return false;
    if (actorId && event.actor_id !== actorId) return false;
    if (from && event.at < from) return false;
    // `to` llega como fecha suelta; se compara contra el fin de ese día.
    if (to && event.at > `${to}T23:59:59.999Z`) return false;
    if (search && !matchesSearch(event, search)) return false;
    return true;
  });
}

function paginate(items: AuditEvent[], query: URLSearchParams): MockResponse {
  const page = Number(query.get('page') ?? 1);
  const limit = Number(query.get('limit') ?? 20);
  const start = (page - 1) * limit;
  return {
    status: 200,
    data: {
      data: items.slice(start, start + limit),
      total: items.length,
      page,
      limit,
      links: {
        next: start + limit < items.length ? `?page=${page + 1}&limit=${limit}` : null,
        previous: page > 1 ? `?page=${page - 1}&limit=${limit}` : null,
      },
    },
  };
}

/**
 * La bitácora es de solo lectura por diseño: no hay POST, PATCH ni DELETE.
 * Los eventos los asienta el propio sistema al escribir, nunca el cliente.
 */
export function routeAudit(
  method: string,
  path: string,
  query: URLSearchParams,
): MockResponse | null {
  if (method !== 'get' || path !== '/audit/') return null;
  return paginate(applyFilters(query), query);
}
