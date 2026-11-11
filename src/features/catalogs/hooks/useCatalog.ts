import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePagination } from '@/shared/hooks/usePagination';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { boolFilter, useListFilters } from '@/shared/hooks/useListFilters';
import { notify } from '@/shared/utils/notify';
import { getCatalogItems, getCatalogs, CatalogItemsQuery } from '../api/catalogsApi';
import { fetchCatalogOptions } from '../api/optionsCache';
import { CatalogDefinition, CatalogItem, CatalogKey } from '../types/catalog.types';

export function useCatalogDefinitions() {
  const [definitions, setDefinitions] = useState<CatalogDefinition[]>([]);
  const [isLoading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getCatalogs();
    if (res.ok) setDefinitions(res.data);
    else notify.fromApiError(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { definitions, isLoading, reload: load };
}

export function useCatalogItems(catalog: CatalogKey) {
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const { values, setFilter, reset } = useListFilters();

  // Otro catálogo es otra lista: el texto y los filtros del anterior no aplican.
  useEffect(() => {
    setSearch('');
    reset();
  }, [catalog, reset]);

  /** Lo que se consulta, sin página ni límite: también es lo que se exporta. */
  const query = useMemo<CatalogItemsQuery>(
    () => ({ catalog, q: q.trim() || undefined, is_active: boolFilter(values.is_active) }),
    [catalog, q, values],
  );

  const pagination = usePagination<CatalogItem, CatalogItemsQuery>({
    fetcher: getCatalogItems,
    initialParams: query,
    initialLimit: 50,
  });

  return {
    ...pagination,
    search,
    setSearch,
    filters: values,
    setFilter,
    clear: () => {
      setSearch('');
      reset();
    },
    query,
  };
}

const OPTIONS_CACHE_PREFIX = 'catalog-options:';

function readCachedItems(catalog: CatalogKey): CatalogItem[] {
  try {
    const raw = localStorage.getItem(OPTIONS_CACHE_PREFIX + catalog);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CatalogItem[]) : [];
  } catch {
    return [];
  }
}

function writeCachedItems(catalog: CatalogKey, items: CatalogItem[]) {
  try {
    localStorage.setItem(OPTIONS_CACHE_PREFIX + catalog, JSON.stringify(items));
  } catch {
    // Sin almacenamiento disponible: se pierde solo el respaldo sin conexión.
  }
}

/**
 * Opciones activas de un catálogo, para alimentar selects de formularios.
 *
 * Se guarda la última lista buena: sin señal el formulario del gasto necesita
 * concepto y moneda para poder encolarse, y sin esto los selects quedan vacíos.
 */
export function useCatalogOptions(catalog: CatalogKey | undefined) {
  const [items, setItems] = useState<CatalogItem[]>(() => (catalog ? readCachedItems(catalog) : []));

  useEffect(() => {
    if (!catalog) return;
    let alive = true;
    setItems(readCachedItems(catalog));
    void fetchCatalogOptions(catalog).then((data) => {
      if (!alive || !data) return;
      setItems(data);
      writeCachedItems(catalog, data);
    });
    return () => {
      alive = false;
    };
  }, [catalog]);

  return useMemo(
    () =>
      items.map((i) => ({
        value: i.code,
        // Dos aeronaves del mismo modelo se leerían idénticas: la matrícula las distingue.
        label: catalog === 'aircrafts' ? `${i.code} · ${i.name}` : i.name,
        extra: i.extra,
      })),
    [items, catalog],
  );
}
