import { AlertTriangle, MessageSquare, Paperclip, Plane } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Column, DataTable } from '@/shared/components/list/DataTable';
import { useT } from '@/shared/hooks/useT';
import { formatDateTime } from '@/shared/utils/formatters';
import { Ticket } from '../types/ticket.types';

interface Props {
  items: Ticket[];
  isLoading: boolean;
  /** Listado dentro de un expediente: no repite a qué operación pertenece cada ticket. */
  compact?: boolean;
}

const isOverdue = (ticket: Ticket) =>
  Boolean(ticket.due_at && !ticket.status_is_final && new Date(ticket.due_at) < new Date());

export function TicketsList({ items, isLoading, compact }: Props) {
  const t = useT();

  const columns: Column<Ticket>[] = [
    {
      key: 'code',
      header: 'list.col.code',
      primary: true,
      cell: (ticket) => <span className="data text-sm font-medium tracking-tight">{ticket.code}</span>,
    },
    {
      key: 'title',
      header: 'list.col.title',
      cell: (ticket) => (
        <div className="min-w-0">
          <p>{ticket.title}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="font-medium">{ticket.type_name}</span>
            {!compact && ticket.parent_code && (
              <span className="flex items-center gap-1">
                <Plane className="h-3 w-3" />
                {ticket.parent_code}
              </span>
            )}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'list.col.status',
      cell: (ticket) => <Badge variant={ticket.status_color}>{ticket.status_name}</Badge>,
    },
    {
      key: 'assigned',
      header: 'list.col.assigned',
      cell: (ticket) => (
        <span className="text-muted-foreground">
          {ticket.assigned_user_name ?? ticket.assigned_role_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'activity',
      header: 'list.col.activity',
      cell: (ticket) => (
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:justify-start">
          {ticket.children_count > 0 && (
            <span>
              {ticket.children_count} {t('tickets.childrenShort')}
            </span>
          )}
          {ticket.attachments > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {ticket.attachments}
            </span>
          )}
          {ticket.comments.length > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {ticket.comments.length}
            </span>
          )}
          {isOverdue(ticket) && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {t('tickets.overdue')}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'list.col.updated',
      cell: (ticket) => (
        <span className="data whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(ticket.updated_at)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={items}
      rowKey={(ticket) => ticket.id}
      isLoading={isLoading}
      emptyMessage="tickets.empty"
      rowHref={(ticket) => `/tickets/${ticket.id}`}
      rowClassName={(ticket) => (isOverdue(ticket) ? 'border-l-2 border-l-destructive' : undefined)}
    />
  );
}
