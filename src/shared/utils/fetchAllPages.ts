import { ApiResult, Paginated } from '@/shared/api/types';

export const EXPORT_MAX_ROWS = 5000;
const EXPORT_PAGE_SIZE = 100;

export type AllPagesResult<T> = ApiResult<{ rows: T[]; truncated: boolean }>;

/**
 * Recorre todas las páginas de un listado con los mismos filtros que la pantalla,
 * hasta `EXPORT_MAX_ROWS`. Usa el endpoint de lista, así que respeta permisos y alcance.
 */
export async function fetchAllPages<T, Q extends object>(
  fetcher: (params: Q & { page: number; limit: number }) => Promise<ApiResult<Paginated<T>>>,
  params: Q,
): Promise<AllPagesResult<T>> {
  const rows: T[] = [];
  for (let page = 1; rows.length < EXPORT_MAX_ROWS; page++) {
    const res = await fetcher({ ...params, page, limit: EXPORT_PAGE_SIZE });
    if (!res.ok) return res;
    rows.push(...res.data.data);
    if (rows.length >= res.data.total || res.data.data.length === 0) {
      return { ok: true, data: { rows, truncated: false } };
    }
  }
  return { ok: true, data: { rows: rows.slice(0, EXPORT_MAX_ROWS), truncated: true } };
}

/** Adapta filas que ya están en memoria al `load` de `ExportButton`. */
export function loadRows<T>(rows: T[]): () => Promise<AllPagesResult<T>> {
  return async () => ({ ok: true, data: { rows, truncated: false } });
}
