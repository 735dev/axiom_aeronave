import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePagination } from '@/shared/hooks/usePagination';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { notify } from '@/shared/utils/notify';
import { useReloadOnSync } from '@/shared/offline/syncEvents';
import {
  getTicket,
  getTicketTotals,
  getTicketTypes,
  getTickets,
  TicketsQuery,
  TotalsQuery,
} from '../api/ticketsApi';
import { ExpenseTotals, Ticket, TicketType } from '../types/ticket.types';

export interface TicketFilterState {
  status_code?: string;
  type_code?: string;
  assigned_role_id?: string;
  open?: boolean;
}

/**
 * Los filtros viven en la URL, no en estado local: así volver desde un
 * expediente conserva lo que el usuario había filtrado, y la lista se puede
 * pasar por enlace ("los gastos abiertos de agosto").
 */
export function useTickets(fixed: TicketsQuery = {}) {
  const [params, setParams] = useSearchParams();
  const [search, setSearchValue] = useState(() => params.get('q') ?? '');
  const q = useDebounce(search, 300);
  const fixedKey = JSON.stringify(fixed);

  const filters = useMemo<TicketFilterState>(() => {
    const open = params.get('abierto');
    return {
      status_code: params.get('estado') ?? undefined,
      type_code: params.get('tipo') ?? undefined,
      assigned_role_id: params.get('rol') ?? undefined,
      open: open === null ? undefined : open === 'true',
    };
  }, [params]);

  const setFilters = useCallback(
    (next: TicketFilterState) => {
      setParams(
        (prev) => {
          const draft = new URLSearchParams(prev);
          const write = (key: string, value: string | undefined) => {
            if (value === undefined || value === '') draft.delete(key);
            else draft.set(key, value);
          };
          write('estado', next.status_code);
          write('tipo', next.type_code);
          write('rol', next.assigned_role_id);
          write('abierto', next.open === undefined ? undefined : String(next.open));
          return draft;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // El texto se escribe sin rebote en la URL: reemplazar la entrada en cada
  // tecla llenaría el historial y haría inútil el botón de volver.
  const setSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
    },
    [],
  );

  useEffect(() => {
    setParams(
      (prev) => {
        const draft = new URLSearchParams(prev);
        if (q) draft.set('q', q);
        else draft.delete('q');
        return draft;
      },
      { replace: true },
    );
  }, [q, setParams]);

  const initialParams = useMemo<TicketsQuery>(
    () => ({ q, ...(JSON.parse(fixedKey) as TicketsQuery), ...filters }),
    [q, filters, fixedKey],
  );

  const pagination = usePagination<Ticket, TicketsQuery>({
    fetcher: getTickets,
    initialParams,
    initialLimit: 20,
  });

  return { ...pagination, search, setSearch, filters, setFilters };
}

export function useTicketTypes(params: { is_active?: boolean; is_root?: boolean } = {}) {
  const [types, setTypes] = useState<TicketType[]>([]);
  const [isLoading, setLoading] = useState(false);
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getTicketTypes(JSON.parse(key));
    if (res.ok) setTypes(res.data);
    else notify.fromApiError(res);
    setLoading(false);
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  return { types, isLoading, reload: load };
}

export function useTicketDetail(id: string | undefined) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [children, setChildren] = useState<Ticket[]>([]);
  const [isLoading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await getTicket(id);
    if (res.ok) {
      setTicket(res.data);
      if (res.data.type_is_root) {
        const kids = await getTickets({ parent_id: id, limit: 100 });
        if (kids.ok) setChildren(kids.data.data);
      }
    } else {
      notify.fromApiError(res);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  useReloadOnSync(() => void load(), Boolean(id));

  return { ticket, children, isLoading, reload: load };
}

/**
 * Totales de una consulta. `revision` fuerza una relectura tras una escritura
 * sin ensuciar la consulta con parámetros que el backend no entiende.
 */
export function useTicketTotals(params: TotalsQuery, enabled = true, revision = 0) {
  const [totals, setTotals] = useState<ExpenseTotals | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [synced, setSynced] = useState(0);
  const key = JSON.stringify(params);
  useReloadOnSync(() => setSynced((n) => n + 1), enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    void getTicketTotals(JSON.parse(key) as TotalsQuery).then((res) => {
      if (!active) return;
      if (res.ok) setTotals(res.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [key, enabled, revision, synced]);

  return { totals, isLoading };
}
