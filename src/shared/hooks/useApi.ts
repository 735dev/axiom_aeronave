import { useCallback, useState } from 'react';
import { ApiResult } from '@/shared/api/types';

export function useApi<TArgs extends unknown[], TData>(
  fn: (...args: TArgs) => Promise<ApiResult<TData>>,
) {
  const [data, setData] = useState<TData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);

  const run = useCallback(
    async (...args: TArgs) => {
      setLoading(true);
      setError(null);
      const res = await fn(...args);
      if (res.ok) setData(res.data);
      else setError(res.detail);
      setLoading(false);
      return res;
    },
    [fn],
  );

  return { run, data, error, isLoading };
}
