import { routeMockRequest } from '@/shared/api/mock/router';

export interface Reply<T = any> {
  status: number;
  data: T;
}

export interface Session {
  token: string;
  user: any;
  get: (path: string, query?: Record<string, string>) => Reply;
  post: (path: string, body?: unknown, key?: string) => Reply;
  patch: (path: string, body?: unknown) => Reply;
  del: (path: string) => Reply;
}

/** Entra como un usuario de los datos de ejemplo y devuelve un cliente del mock. */
export function loginAs(email: string): Session {
  const res = routeMockRequest({
    method: 'post',
    path: '/auth/login/',
    query: new URLSearchParams(),
    body: { email, password: 'demo1234' },
  });
  if (res.status !== 200) throw new Error(`login ${email}: ${res.status}`);
  const login = res.data as any;
  const token: string = login.token;
  const call = (method: string, path: string, body?: unknown, key?: string, q?: Record<string, string>) =>
    routeMockRequest({
      method,
      path,
      query: new URLSearchParams(q),
      body,
      token,
      idempotencyKey: key,
    });
  return {
    token,
    user: login.user,
    get: (path, q) => call('get', path, undefined, undefined, q),
    post: (path, body, key) => call('post', path, body, key),
    patch: (path, body) => call('patch', path, body),
    del: (path) => call('delete', path),
  };
}

export const USERS = {
  superuser: 'super@transvalor.com',
  operations: 'operaciones@transvalor.com',
  pilot: 'piloto@transvalor.com',
  admin: 'admin@transvalor.com',
  director: 'gerencia@transvalor.com',
  maintenance: 'mantenimiento@transvalor.com',
} as const;

/** Imagen mínima válida como `data:` URL. */
export const PNG = 'data:image/png;base64,iVBORw0KGgo=';

/** `data:` URL de un tamaño exacto en bytes, sin reservar memoria absurda. */
export function dataUrlOfBytes(bytes: number, mime = 'application/pdf'): string {
  const chars = Math.ceil((bytes * 4) / 3);
  const padded = chars + ((4 - (chars % 4)) % 4);
  const raw = 'A'.repeat(padded);
  // Cada `=` de relleno resta un byte; se ajusta para caer justo en `bytes`.
  const excess = Math.floor((padded * 3) / 4) - bytes;
  const body = excess > 0 ? raw.slice(0, padded - excess) + '='.repeat(excess) : raw;
  return `data:${mime};base64,${body}`;
}

export function findTicket(s: Session, predicate: (t: any) => boolean): any {
  const all = s.get('/tickets/', { limit: '200' }).data.data as any[];
  const hit = all.find(predicate);
  if (!hit) throw new Error('ticket de ejemplo no encontrado');
  return hit;
}

export const EXPENSE = { concept: 'fuel', amount: 100, currency: 'USD' };

export function newExpense(s: Session, parentId: string, extra: Record<string, unknown> = {}) {
  return s.post('/tickets/', {
    type_code: 'expense',
    title: 'Gasto de prueba',
    parent_id: parentId,
    payload: { ...EXPENSE, ...extra },
  });
}
