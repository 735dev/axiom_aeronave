import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { useNotifications } from '../hooks/useNotifications';
import { markAllNotificationsRead, markNotificationRead } from '../api/notificationsApi';
import { AppNotification } from '../types/notification.types';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { PaginatedComplete } from '@/shared/components/pagination/PaginatedComplete';
import { useT } from '@/shared/hooks/useT';
import { formatDateTime } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';
import { notify } from '@/shared/utils/notify';

const BORDER_BY_KIND: Record<string, string> = {
  operation_created: 'border-l-blue-500',
  ticket_assigned: 'border-l-blue-500',
  close_blocked: 'border-l-red-500',
  receipt_validation: 'border-l-amber-500',
  navaid_pending: 'border-l-red-500',
  technical_report: 'border-l-amber-500',
  operation_closed: 'border-l-emerald-500',
};

export function NotificationsPage() {
  const t = useT();
  const navigate = useNavigate();
  const list = useNotifications();

  useLiveRefresh(() => void list.reload());

  const onOpen = async (n: AppNotification) => {
    if (!n.read) {
      const res = await markNotificationRead(n.id);
      if (!res.ok) {
        notify.fromApiError(res);
        return;
      }
      void list.reload();
    }
    if (n.ticket_id) navigate(`/tickets/${n.ticket_id}`);
  };

  const onlyUnread = list.params.unread === true;
  const markAll = async () => {
    const res = await markAllNotificationsRead();
    if (!res.ok) {
      notify.fromApiError(res);
      return;
    }
    void list.reload();
  };

  return (
    <section className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">{t('notifications.title')}</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={onlyUnread ? 'default' : 'outline'}
            data-testid="notifications-unread-filter"
            onClick={() => list.setParams({ unread: onlyUnread ? undefined : true })}
          >
            {t('notifications.onlyUnread')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="notifications-read-all"
            onClick={() => void markAll()}
          >
            {t('notifications.markAllRead')}
          </Button>
        </div>
      </div>

      {list.items.length === 0 && !list.isLoading && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('notifications.empty')}
        </p>
      )}

      <div className="space-y-3">
        {list.items.map((n) => (
          <Card
            key={n.id}
            onClick={() => void onOpen(n)}
            className={cn(
              'cursor-pointer border-l-4 p-4',
              BORDER_BY_KIND[n.kind] ?? 'border-l-border',
              n.read && 'opacity-60',
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium">{t(`notifications.kind.${n.kind}`)}</p>
              {!n.read && <Bell className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {n.audience.map((a) => (
                <Badge key={a}>{a}</Badge>
              ))}
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDateTime(n.created_at)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <PaginatedComplete
        page={list.page}
        limit={list.limit}
        total={list.total}
        links={list.links}
        onPageChange={list.setPage}
      />
    </section>
  );
}
