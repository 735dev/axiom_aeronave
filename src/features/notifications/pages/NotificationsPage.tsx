import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { useNotifications } from '../hooks/useNotifications';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notificationsApi';
import { AppNotification, NotificationKind } from '../types/notification.types';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Column, DataTable } from '@/shared/components/list/DataTable';
import { PaginatedComplete } from '@/shared/components/pagination/PaginatedComplete';
import { ListToolbar, FilterDef } from '@/shared/components/list/ListToolbar';
import { ExportButton } from '@/shared/components/list/ExportButton';
import { CsvColumn } from '@/shared/utils/csv';
import { fetchAllPages } from '@/shared/utils/fetchAllPages';
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

const KINDS: NotificationKind[] = [
  'operation_created',
  'ticket_assigned',
  'navaid_pending',
  'close_blocked',
  'technical_report',
  'receipt_validation',
  'operation_closed',
];

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

  const filterDefs: FilterDef[] = [
    {
      key: 'kind',
      label: t('list.filter.kind'),
      type: 'select',
      options: KINDS.map((k) => ({ value: k, label: t(`notifications.kind.${k}`) })),
    },
  ];

  const exportColumns: CsvColumn<AppNotification>[] = [
    { header: t('list.col.created'), value: (n) => formatDateTime(n.created_at) },
    { header: t('list.col.kind'), value: (n) => t(`notifications.kind.${n.kind}`) },
    { header: t('list.col.body'), value: (n) => n.body },
    { header: t('list.col.operation'), value: (n) => n.operation_code },
    { header: t('list.col.audience'), value: (n) => n.audience.join(' / ') },
    { header: t('list.col.read'), value: (n) => (n.read ? t('common.yes') : t('common.no')) },
  ];

  const onlyUnread = list.filters.unread === 'true';
  const markAll = async () => {
    const res = await markAllNotificationsRead();
    if (!res.ok) {
      notify.fromApiError(res);
      return;
    }
    void list.reload();
  };

  const columns: Column<AppNotification>[] = [
    {
      key: 'kind',
      header: 'list.col.kind',
      primary: true,
      cell: (n) => (
        <span className="flex items-center gap-2 font-medium">
          {t(`notifications.kind.${n.kind}`)}
          {!n.read && <Bell className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </span>
      ),
    },
    { key: 'body', header: 'list.col.body', cell: (n) => <span className="text-muted-foreground">{n.body}</span> },
    {
      key: 'audience',
      header: 'list.col.audience',
      cell: (n) => (
        <span className="flex flex-wrap gap-1.5 md:justify-start">
          {n.audience.map((a) => (
            <Badge key={a}>{a}</Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'list.col.created',
      cell: (n) => <span className="data text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>,
    },
  ];

  return (
    <section className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">{t('notifications.title')}</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={onlyUnread ? 'default' : 'outline'}
            data-testid="notifications-unread-filter"
            onClick={() => list.setFilter('unread', onlyUnread ? '' : 'true')}
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

      <ListToolbar
        filters={filterDefs}
        values={list.filters}
        onFilter={list.setFilter}
        onClear={list.clear}
        actions={
          <ExportButton
            filename="avisos"
            columns={exportColumns}
            disabled={list.total === 0}
            load={() => fetchAllPages(getNotifications, list.query)}
          />
        }
      />

      <DataTable
        columns={columns}
        rows={list.items}
        rowKey={(n) => n.id}
        isLoading={list.isLoading}
        emptyMessage="notifications.empty"
        onRowClick={(n) => void onOpen(n)}
        rowClassName={(n) =>
          cn('border-l-4', BORDER_BY_KIND[n.kind] ?? 'border-l-border', n.read && 'opacity-60')
        }
      />

      <PaginatedComplete
        page={list.page}
        limit={list.limit}
        total={list.total}
        links={list.links}
        onPageChange={list.setPage}
        onLimitChange={list.setLimit}
      />
    </section>
  );
}
