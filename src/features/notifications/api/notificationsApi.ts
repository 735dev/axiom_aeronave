import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully, qs } from '@/shared/api/handlers';
import { ApiResult, Paginated } from '@/shared/api/types';
import { AppNotification } from '../types/notification.types';

export interface NotificationsQuery {
  page?: number;
  limit?: number;
  /** Solo los que el usuario aún no leyó. */
  unread?: boolean;
  kind?: string;
  ticket_id?: string;
}

/** Lista del usuario en sesión; `unread` cuenta todos sus no leídos, no solo la página. */
export type NotificationsList = Paginated<AppNotification> & { unread: number };

/** Aviso a las vistas abiertas (campana, página) de que el estado de lectura cambió. */
export const NOTIFICATIONS_CHANGED = 'notifications:changed';

export async function getNotifications(
  params: NotificationsQuery,
): Promise<ApiResult<NotificationsList>> {
  try {
    const res = await apiAxios.get({ url: `/notifications/?${qs({ ...params })}` });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'links'))
      return { ok: true, data: body as NotificationsList };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function markNotificationRead(id: string): Promise<ApiResult<AppNotification>> {
  try {
    const res = await apiAxios.patch({ url: `/notifications/${id}/`, data: { read: true } });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) {
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
      return { ok: true, data: body };
    }
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

/** Marca como leído todo lo del usuario en sesión. */
export async function markAllNotificationsRead(): Promise<
  ApiResult<{ marked: number; unread: number }>
> {
  try {
    const res = await apiAxios.post({ url: '/notifications/read-all/' });
    if (isSuccessfully(res.status, res.data, 'marked')) {
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
      return { ok: true, data: res.data };
    }
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
