import { useEffect, useMemo, useState } from 'react';
import { PAGE_SIZE_OPTIONS } from '@/shared/components/pagination/PaginatedComplete';

interface Args<T> {
  items: T[];
  /** Texto en el que busca el search; se compara sin tildes ni mayúsculas. */
  searchText?: (item: T) => string;
  /** Un predicado por filtro: recibe el valor elegido (nunca vacío). */
  filters?: Record<string, (item: T, value: string) => boolean>;
  initialLimit?: number;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Búsqueda (sin tildes ni mayúsculas) y filtros; un filtro con valor vacío no filtra. */
export function applyList<T>(
  items: T[],
  search: string,
  values: Record<string, string>,
  searchText?: (item: T) => string,
  filters: Record<string, (item: T, value: string) => boolean> = {},
): T[] {
  const needle = fold(search.trim());
  return items.filter((item) => {
    if (needle && searchText && !fold(searchText(item)).includes(needle)) return false;
    return Object.entries(values).every(([key, value]) => !value || !filters[key] || filters[key]!(item, value));
  });
}

/** La página no puede pasarse de la última ni bajar de 1. */
export function clampPage(page: number, total: number, limit: number): number {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / limit)));
}

/**
 * Search, filtros y paginación sobre una lista que ya está en memoria
 * (tipos de ticket, reglas, módulos…: pocos registros, sin endpoint paginado).
 */
export function useClientList<T>({ items, searchText, filters = {}, initialLimit = PAGE_SIZE_OPTIONS[1] ?? 25 }: Args<T>) {
  const [search, setSearch] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  const filtered = useMemo(
    () => applyList(items, search, values, searchText, filters),
    // `filters` y `searchText` son literales del llamador: la identidad cambia cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, search, values],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const rows = useMemo(() => filtered.slice((page - 1) * limit, page * limit), [filtered, page, limit]);

  return {
    rows,
    /** Todo lo filtrado, sin paginar: es lo que se exporta. */
    filtered,
    search,
    setSearch: (v: string) => {
      setSearch(v);
      setPage(1);
    },
    values,
    setFilter: (key: string, value: string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setPage(1);
    },
    clear: () => {
      setSearch('');
      setValues({});
      setPage(1);
    },
    page,
    limit,
    total: filtered.length,
    links: {
      previous: page > 1 ? 'prev' : null,
      next: page < totalPages ? 'next' : null,
    },
    setPage,
    setLimit: (n: number) => {
      setLimit(n);
      setPage(1);
    },
  };
}
