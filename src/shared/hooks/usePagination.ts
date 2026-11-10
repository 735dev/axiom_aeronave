import { useCallback, useEffect, useState } from 'react';
import type { SetStateAction } from 'react';
import { env } from '@/shared/config/env';
import { ApiResult, Paginated } from '@/shared/api/types';
import { notify } from '@/shared/utils/notify';
import { useReloadOnSync } from '@/shared/offline/syncEvents';

interface UsePaginationArgs<T, Q extends object> {
  fetcher: (params: Q & { page: number; limit: number }) => Promise<ApiResult<Paginated<T>>>;
  initialParams: Q;
  initialLimit?: number;
  enabled?: boolean;
}

export function usePagination<T, Q extends object>({
  fetcher,
  initialParams,
  initialLimit = env.limit,
  enabled = true,
}: UsePaginationArgs<T, Q>) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [params, setParams] = useState<Q>(initialParams);
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<Pick<Paginated<T>, 'total' | 'links'>>({
    total: 0,
    links: { next: null, previous: null },
  });
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    setParams(initialParams);
    setPage(1);
  }, [initialParams]);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const res = await fetcher({ ...params, page, limit });
    if (res.ok) {
      setItems(res.data.data);
      setMeta({ total: res.data.total, links: res.data.links });
    } else {
      notify.fromApiError(res);
    }
    setLoading(false);
  }, [fetcher, params, page, limit, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  // Lo que la cola envió al volver la red debe aparecer sin recargar.
  useReloadOnSync(() => void load(), enabled);

  // Cambiar cuántos se muestran o con qué se filtra invalida la página actual.
  const changeLimit = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);
  const changeParams = useCallback((next: SetStateAction<Q>) => {
    setParams(next);
    setPage(1);
  }, []);

  return {
    page,
    limit,
    params,
    total: meta.total,
    links: meta.links,
    items,
    isLoading,
    setPage,
    setLimit: changeLimit,
    setParams: changeParams,
    reload: load,
  };
}
