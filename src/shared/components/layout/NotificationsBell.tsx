import { useReloadOnSync } from '@/shared/offline/syncEvents';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import {
  getNotifications,
  markNotificationRead,
} from '@/features/notifications/api/notificationsApi';
import { useLiveRefresh } from '@/features/notifications/hooks/useLiveRefresh';
import { AppNotification } from '@/features/notifications/types/notification.types';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { useCan } from '@/shared/hooks/useCan';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { formatDateTime } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';

const BORDER_BY_KIND: Record<string, string> = {
  operation_created: 'border-l-info',
  ticket_assigned: 'border-l-info',
  close_blocked: 'border-l-destructive',
  receipt_validation: 'border-l-primary',
  navaid_pending: 'border-l-destructive',
  technical_report: 'border-l-primary',
  operation_closed: 'border-l-success',
};

export function NotificationsBell() {
  const t = useT();
  const { can } = useCan();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const allowed = can(PERMISSIONS.notificationsView);

  const load = async () => {
    const res = await getNotifications({ limit: 8 });
    if (res.ok) {
      setItems(res.data.data);
      // El conteo viene del servidor: sobre las 8 filas visibles subcontaría.
      setUnread(res.data.unread);
    }
  };

  useEffect(() => {
    if (allowed) void load();
  }, [allowed]);

  useLiveRefresh(() => void load(), allowed);
  useReloadOnSync(() => void load(), allowed);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!allowed) return null;

  const onRead = async (notification: AppNotification) => {
    if (!notification.read) {
      const res = await markNotificationRead(notification.id);
      if (res.ok) void load();
    }
    if (notification.ticket_id) {
      setOpen(false);
      navigate(`/tickets/${notification.ticket_id}`);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('nav.notifications')}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-medium">{t('notifications.title')}</span>
            {unread > 0 && (
              <span className="text-xs text-muted-foreground">
                {unread} {t('notifications.unread')}
              </span>
            )}
          </div>

          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void onRead(n)}
                  className={cn(
                    'w-full border-l-4 px-4 py-3 text-left hover:bg-muted',
                    BORDER_BY_KIND[n.kind] ?? 'border-l-border',
                    n.read && 'opacity-60',
                  )}
                >
                  <p className="text-sm font-medium">{t(`notifications.kind.${n.kind}`)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDateTime(n.created_at)}
                  </p>
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('notifications.empty')}
              </li>
            )}
          </ul>

          <Link
            to="/avisos"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-2.5 text-center text-sm text-primary hover:bg-muted"
          >
            {t('notifications.seeAll')}
          </Link>
        </div>
      )}
    </div>
  );
}
