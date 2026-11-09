import { Link } from 'react-router-dom';
import { AlertTriangle, MessageSquare, Paperclip, Plane } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useT } from '@/shared/hooks/useT';
import { formatDateTime } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';
import { Ticket } from '../types/ticket.types';

interface Props {
  items: Ticket[];
  isLoading: boolean;
  compact?: boolean;
}

export function TicketsList({ items, isLoading, compact }: Props) {
  const t = useT();

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('common.loading')}</p>;
  }
  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t('tickets.empty')}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((ticket) => {
        const overdue =
          ticket.due_at && !ticket.status_is_final && new Date(ticket.due_at) < new Date();

        return (
          <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="block">
            <Card
              className={cn(
                'border-l-2 border-l-transparent transition-colors hover:border-l-primary hover:bg-muted/40',
                compact ? 'p-3' : 'p-3.5',
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="data text-sm font-medium tracking-tight">{ticket.code}</span>
                <Badge variant={ticket.status_color}>{ticket.status_name}</Badge>
              </div>

              <p className="mt-0.5 text-sm text-muted-foreground">{ticket.title}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{ticket.type_name}</span>
                {ticket.assigned_role_name && (
                  <span className="text-xs text-muted-foreground">
                    · {ticket.assigned_role_name}
                  </span>
                )}
                {!compact && ticket.parent_code && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Plane className="h-3 w-3" />
                    {ticket.parent_code}
                  </span>
                )}
                {ticket.children_count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {ticket.children_count} {t('tickets.childrenShort')}
                  </span>
                )}
                {ticket.attachments > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    {ticket.attachments}
                  </span>
                )}
                {ticket.comments.length > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    {ticket.comments.length}
                  </span>
                )}
                {overdue && (
                  <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    {t('tickets.overdue')}
                  </span>
                )}
                <span className="data ml-auto text-xs text-muted-foreground">
                  {formatDateTime(ticket.updated_at)}
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
