import { useMemo } from 'react';
import { usePagination } from '@/shared/hooks/usePagination';
import { orUndefined, useListFilters } from '@/shared/hooks/useListFilters';
import { getNotifications, NotificationsQuery } from '../api/notificationsApi';
import { AppNotification } from '../types/notification.types';

export function useNotifications() {
  const { values, setFilter, reset } = useListFilters();

  /** Lo que se consulta, sin página ni límite: también es lo que se exporta. */
  const query = useMemo<NotificationsQuery>(
    () => ({ kind: orUndefined(values.kind), unread: values.unread === 'true' ? true : undefined }),
    [values],
  );

  const pagination = usePagination<AppNotification, NotificationsQuery>({
    fetcher: getNotifications,
    initialParams: query,
    initialLimit: 25,
  });

  return { ...pagination, filters: values, setFilter, clear: reset, query };
}
