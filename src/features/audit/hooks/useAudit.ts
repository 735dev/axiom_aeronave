import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePagination } from '@/shared/hooks/usePagination';
import { getAuditEvents, AuditQuery } from '../api/auditApi';
import { AuditEvent, AuditFilters } from '../types/audit.types';

export function useAuditLog(filters: AuditFilters) {
  const initialParams = useMemo<AuditQuery>(() => ({ ...filters }), [filters]);

  return usePagination<AuditEvent, AuditQuery>({
    fetcher: getAuditEvents,
    initialParams,
    initialLimit: 25,
  });
}

/** Bitácora de una sola entidad, para el detalle de un ticket. */
export function useEntityAudit(entity: AuditEvent['entity'], entityId?: string) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setLoading] = useState(false);
  /** Se incrementa para releer tras una escritura sobre la misma entidad. */
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!entityId) return;
    let active = true;
    setLoading(true);
    void getAuditEvents({ entity, entity_id: entityId, limit: 50 }).then((res) => {
      if (!active) return;
      if (res.ok) setEvents(res.data.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [entity, entityId, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  return { events, isLoading, reload };
}
