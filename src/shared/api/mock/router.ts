import { AppNotification } from '@/features/notifications/types/notification.types';
import { markAllReadFor, markReadFor, notificationsFor } from './notifications';
import { adminState, effectivePermissionsFor, routeAdmin } from './routes/adminRoutes';
import { routeTickets } from './routes/ticketsRoutes';
import { routeAudit } from './routes/auditRoutes';
import { routeProfile } from './routes/profileRoutes';
import { routeReconciliation } from './routes/reconciliationRoutes';
import { setIdempotencyKey } from './requestContext';
import { recordAudit, setAuditActor } from './auditDb';

export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  token?: string;
  /** Cabecera `Idempotency-Key`: identifica una acción del usuario, no un intento. */
  idempotencyKey?: string;
}

export interface MockResponse {
  status: number;
  data: unknown;
}

function paginate<T>(items: T[], query: URLSearchParams): MockResponse {
  const page = Number(query.get('page') ?? 1);
  const limit = Number(query.get('limit') ?? 10);
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

function asRecord(body: unknown): Record<string, unknown> {
  if (body instanceof FormData) return Object.fromEntries(body.entries());
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (body ?? {}) as Record<string, unknown>;
}

function handleLogin(body: Record<string, unknown>): MockResponse {
  const email = String(body.email ?? '').toLowerCase();
  const account = adminState.users.find((u) => u.email === email);
  if (!account || !account.is_active) {
    recordAudit({
      action: 'login_failed',
      entity: 'session',
      entity_id: email,
      entity_label: email,
      summary: `Intento de acceso fallido con ${email || 'correo vacío'}`,
      actor: { id: 'anonymous', name: email || 'Desconocido', role: 'Sin sesión' },
    });
    return { status: 401, data: { title: 'auth.login.invalid', detail: 'auth.login.invalid' } };
  }
  const role = adminState.roles.find((r) => r.id === account.role_id);
  recordAudit({
    action: 'login',
    entity: 'session',
    entity_id: account.id,
    entity_label: account.email,
    summary: `${account.full_name} inició sesión`,
    actor: { id: account.id, name: account.full_name, role: account.role_name },
  });
  return {
    status: 200,
    data: {
      token: `mock-token-${account.id}`,
      refresh_token: 'mock-refresh',
      user: {
        id: account.id,
        email: account.email,
        full_name: account.full_name,
        avatar_url: account.avatar_url,
        role_id: account.role_id,
        role_code: role?.code ?? '',
        role_name: account.role_name,
        aircraft_id: account.aircraft_id,
      },
      permissions: effectivePermissionsFor(account.id),
    },
  };
}

function handleSession(token?: string): MockResponse {
  const id = token?.replace('mock-token-', '');
  const account = adminState.users.find((u) => u.id === id);
  if (!account || !account.is_active) {
    return { status: 401, data: { title: 'errors.unauthorizedTitle' } };
  }
  const role = adminState.roles.find((r) => r.id === account.role_id);
  if (!role || !role.is_active) {
    return { status: 401, data: { title: 'errors.unauthorizedTitle' } };
  }
  return {
    status: 200,
    data: {
      user: {
        id: account.id,
        email: account.email,
        full_name: account.full_name,
        avatar_url: account.avatar_url,
        role_id: account.role_id,
        role_code: role.code,
        role_name: role.name,
        aircraft_id: account.aircraft_id,
      },
      permissions: effectivePermissionsFor(account.id),
    },
  };
}

function dispatchMockRequest(req: MockRequest): MockResponse {
  const { method, path, query } = req;
  const body = asRecord(req.body);

  // El actor sale del token, nunca del cuerpo: si lo enviara el cliente,
  // cualquiera podría firmar la bitácora con el nombre de otro.
  const actorAccount = adminState.users.find((u) => u.id === req.token?.replace('mock-token-', ''));
  setAuditActor(
    actorAccount
      ? { id: actorAccount.id, name: actorAccount.full_name, role: actorAccount.role_name }
      : null,
  );

  if (method === 'get' && path === '/auth/me/') return handleSession(req.token);
  if (method === 'post' && path === '/auth/login/') return handleLogin(body);
  if (method === 'post' && path === '/auth/logout/') return { status: 204, data: null };

  const profile = routeProfile(method, path, body);
  if (profile) return profile;

  const audit = routeAudit(method, path, query);
  if (audit) return audit;

  const admin = routeAdmin(method, path, query, body);
  if (admin) return admin;

  const reconciliation = routeReconciliation(method, path, query, body);
  if (reconciliation) return reconciliation;

  const ticketsRoute = routeTickets(method, path, query, body);
  if (ticketsRoute) return ticketsRoute;

  // Los avisos se filtran por quien pregunta, siempre en el servidor, y nunca
  // se atienden sin sesión: sin identidad no hay audiencia que calcular.
  const notifDetail = /^\/notifications\/([^/]+)\/$/.exec(path);
  if (path === '/notifications/' || path === '/notifications/read-all/' || notifDetail) {
    if (!actorAccount) return { status: 401, data: { title: 'errors.unauthorizedTitle' } };
    const viewer = { id: actorAccount.id, role_id: actorAccount.role_id };
    if (method === 'post' && path === '/notifications/read-all/') {
      return { status: 200, data: markAllReadFor(viewer) };
    }
    if (method === 'get' && !notifDetail) {
      const mine = notificationsFor(viewer);
      if (query.get('unread') === 'true') mine.items = mine.items.filter((n) => !n.read);
      if (query.get('kind')) mine.items = mine.items.filter((n) => n.kind === query.get('kind'));
      if (query.get('ticket_id')) {
        mine.items = mine.items.filter((n) => n.ticket_id === query.get('ticket_id'));
      }
      const page = paginate(mine.items, query);
      return { status: 200, data: { ...(page.data as object), unread: mine.unread } };
    }
    if (method === 'patch' && notifDetail) {
      const n = markReadFor(viewer, notifDetail[1] ?? '');
      return n
        ? { status: 200, data: n }
        : { status: 404, data: { title: 'errors.notFoundTitle' } };
    }
  }

  return {
    status: 404,
    data: { title: 'errors.notFoundTitle', detail: `Mock sin ruta: ${method} ${path}` },
  };
}

/** Respuestas ya dadas por clave. En el servidor real esto vive en la base de datos. */
const replayCache = new Map<string, { fingerprint: string; response: MockResponse }>();

/** Huella del cuerpo: dos peticiones con la misma clave deben ser la misma petición. */
function fingerprint(req: MockRequest): string {
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? null);
  let h = 5381;
  for (let i = 0; i < body.length; i += 1) h = ((h << 5) + h + body.charCodeAt(i)) | 0;
  return `${body.length}:${h}`;
}

/**
 * Un POST repetido con la misma clave devuelve lo que ya respondió, sin volver
 * a ejecutar. Es lo que permite reintentar tras perder la señal sin crear dos
 * gastos. La clave es por usuario: la de otro no sirve para ver su respuesta.
 *
 * La misma clave con otro cuerpo es un error del cliente, no un reintento:
 * devolver en silencio el resultado de otra petición escondería el fallo.
 */
export function routeMockRequest(req: MockRequest): MockResponse {
  setIdempotencyKey(req.idempotencyKey);
  const cacheable = req.method === 'post' && Boolean(req.idempotencyKey) && Boolean(req.token);
  const id = cacheable ? `${req.token}|${req.path}|${req.idempotencyKey}` : '';
  const print = cacheable ? fingerprint(req) : '';
  if (cacheable) {
    const hit = replayCache.get(id);
    if (hit) {
      if (hit.fingerprint !== print) {
        return {
          status: 422,
          data: {
            title: 'errors.validationTitle',
            detail: 'Esa clave de idempotencia ya se usó con otro contenido.',
            codigo: 'idempotencia',
          },
        };
      }
      return hit.response;
    }
  }
  const response = dispatchMockRequest(req);
  // Solo se recuerdan los éxitos: un rechazo se puede corregir y reenviar.
  if (cacheable && response.status < 300) replayCache.set(id, { fingerprint: print, response });
  return response;
}

export type { AppNotification };
