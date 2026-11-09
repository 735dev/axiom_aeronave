import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePagination } from '@/shared/hooks/usePagination';
import { notify } from '@/shared/utils/notify';
import { getCatalogItems, getCatalogs, CatalogItemsQuery } from '../api/catalogsApi';
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
  const initialParams = useMemo<CatalogItemsQuery>(() => ({ catalog }), [catalog]);

  return usePagination<CatalogItem, CatalogItemsQuery>({
    fetcher: getCatalogItems,
    initialParams,
    initialLimit: 50,
  });
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
export function useCatalogOptions(catalog: CatalogKey) {
  const [items, setItems] = useState<CatalogItem[]>(() => readCachedItems(catalog));

  useEffect(() => {
    setItems(readCachedItems(catalog));
    void getCatalogItems({ catalog, is_active: true, limit: 100 }).then((res) => {
      if (!res.ok) return;
      setItems(res.data.data);
      writeCachedItems(catalog, res.data.data);
    });
  }, [catalog]);

  return useMemo(() => items.map((i) => ({ value: i.code, label: i.name })), [items]);
}
