import { useMemo } from 'react';
import { usePagination } from '@/shared/hooks/usePagination';
import { getNotifications, NotificationsQuery } from '../api/notificationsApi';
import { AppNotification } from '../types/notification.types';

export function useNotifications() {
  const initialParams = useMemo<NotificationsQuery>(() => ({}), []);

  return usePagination<AppNotification, NotificationsQuery>({
    fetcher: getNotifications,
    initialParams,
    initialLimit: 20,
  });
}
