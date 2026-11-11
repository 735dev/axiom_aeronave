import { AuditChange, AuditEvent } from '../types/audit.types';
import { useT } from '@/shared/hooks/useT';

/** Fecha y hora completas, con segundos: en el detalle sí importa el instante exacto. */
function fullDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-VE', {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date(iso));
}

function renderValue(value: unknown, yes: string, no: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? yes : no;
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-x-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function ChangesTable({ changes, created }: { changes: AuditChange[]; created: boolean }) {
  const t = useT();
  const yes = t('common.yes');
  const no = t('common.no');
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th scope="col" className="px-3 py-2 font-medium">
              {t('audit.detail.field')}
            </th>
            {!created && (
              <th scope="col" className="px-3 py-2 font-medium">
                {t('audit.detail.before')}
              </th>
            )}
            <th scope="col" className="px-3 py-2 font-medium">
              {created ? t('audit.detail.value') : t('audit.detail.after')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {changes.map((c, i) => (
            <tr key={`${c.field}-${i}`}>
              <td className="px-3 py-2 text-muted-foreground">{c.label}</td>
              {!created && (
                <td className="data px-3 py-2 text-muted-foreground">
                  {renderValue(c.from, yes, no)}
                </td>
              )}
              <td className="data px-3 py-2 font-medium">{renderValue(c.to, yes, no)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * El detalle completo de un hecho: qué cambió, quién, cuándo y desde dónde.
 * La tabla de la bitácora muestra una línea por hecho; todo lo demás está aquí.
 */
export function AuditDetail({ event }: { event: AuditEvent }) {
  const t = useT();
  const created = event.action === 'create';
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {created ? t('audit.detail.initialValues') : t('audit.detail.changes')}
        </h3>
        {event.changes.length > 0 ? (
          <ChangesTable changes={event.changes} created={created} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('audit.detail.noChanges')}</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('audit.detail.record')}
        </h3>
        <dl className="divide-y divide-border">
          <Meta label={t('audit.detail.when')}>{fullDateTime(event.at)}</Meta>
          <Meta label={t('audit.detail.user')}>
            {event.actor_name} <span className="text-muted-foreground">· {event.actor_role}</span>
          </Meta>
          <Meta label={t('audit.action')}>{t(`audit.actions.${event.action}`)}</Meta>
          <Meta label={t('audit.detail.entity')}>
            {t(`audit.entities.${event.entity}`)}{' '}
            <span className="data text-muted-foreground">· {event.entity_label}</span>
          </Meta>
          <Meta label={t('audit.detail.entityId')}>
            <span className="data text-xs">{event.entity_id}</span>
          </Meta>
          {event.ip && (
            <Meta label={t('audit.detail.ip')}>
              <span className="data">{event.ip}</span>
            </Meta>
          )}
          {event.user_agent && (
            <Meta label={t('audit.detail.device')}>
              <span className="text-xs text-muted-foreground">{event.user_agent}</span>
            </Meta>
          )}
          <Meta label={t('audit.detail.eventId')}>
            <span className="data text-xs">{event.id}</span>
          </Meta>
        </dl>
      </section>
    </div>
  );
}
