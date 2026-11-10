import {
  ArrowRight,
  FilePlus2,
  KeyRound,
  LogIn,
  MessageSquare,
  PenLine,
  ShieldAlert,
  SignpostBig,
  Stamp,
} from 'lucide-react';
import { AuditAction, AuditChange, AuditEvent } from '../types/audit.types';
import { formatDateTime } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';

const ICONS: Record<AuditAction, typeof PenLine> = {
  create: FilePlus2,
  update: PenLine,
  status_change: SignpostBig,
  decision: Stamp,
  comment: MessageSquare,
  attach: FilePlus2,
  delete: ShieldAlert,
  login: LogIn,
  login_failed: ShieldAlert,
  denied: ShieldAlert,
  logout: LogIn,
  permission_change: KeyRound,
  export: FilePlus2,
};

/** Las acciones sensibles se marcan para que salten a la vista al revisar. */
const SENSITIVE: AuditAction[] = ['permission_change', 'delete', 'login_failed', 'denied'];

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function ChangeRow({ change }: { change: AuditChange }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-0.5 text-xs">
      <span className="text-muted-foreground">{change.label}</span>
      <span className="data text-muted-foreground/70 line-through">
        {renderValue(change.from)}
      </span>
      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="data font-medium">{renderValue(change.to)}</span>
    </li>
  );
}

/** Los campos que cambió un hecho, antes y después. Lo usan la línea de tiempo y la bitácora global. */
export function AuditChangeList({ changes }: { changes: AuditChange[] }) {
  if (changes.length === 0) return null;
  return (
    <ul className="rounded-lg border border-border bg-muted/60 px-3 py-1.5">
      {changes.map((change, i) => (
        <ChangeRow key={`${change.field}-${i}`} change={change} />
      ))}
    </ul>
  );
}

interface Props {
  events: AuditEvent[];
  /** Muestra a qué entidad pertenece cada hecho: útil en la bitácora global. */
  showEntity?: boolean;
  emptyLabel: string;
}

export function AuditTimeline({ events, showEntity = false, emptyLabel }: Props) {
  if (events.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ol className="space-y-0">
      {events.map((event, index) => {
        const Icon = ICONS[event.action] ?? PenLine;
        const sensitive = SENSITIVE.includes(event.action);

        return (
          <li key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                  sensitive
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : 'border-border bg-muted text-muted-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              {index < events.length - 1 && <span className="w-px flex-1 bg-border" />}
            </div>

            <div className="min-w-0 flex-1 pb-4">
              <p className="text-sm">{event.summary}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">{event.actor_name}</span>
                {' · '}
                {event.actor_role}
                {' · '}
                <span className="data">{formatDateTime(event.at)}</span>
                {showEntity && (
                  <>
                    {' · '}
                    <span className="data">{event.entity_label}</span>
                  </>
                )}
              </p>

              {event.changes.length > 0 && (
                <ul className="mt-1.5 rounded-lg border border-border bg-muted/60 px-3 py-1.5">
                  {event.changes.map((change, i) => (
                    <ChangeRow key={`${change.field}-${i}`} change={change} />
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
