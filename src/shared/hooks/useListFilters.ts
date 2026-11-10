import { useCallback, useState } from 'react';

const NO_FILTERS: Record<string, string> = {};

/** Valores de los filtros de una lista; vacío = sin filtrar. `initial` debe ser estable entre renders. */
export function useListFilters(initial: Record<string, string> = NO_FILTERS) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const setFilter = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);
  const reset = useCallback(() => setValues(initial), [initial]);
  return { values, setFilter, reset };
}

/** `'true'`/`'false'` del select a booleano; vacío a `undefined` (qs() lo descarta). */
export function boolFilter(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export const orUndefined = (value: string | undefined): string | undefined => value || undefined;
