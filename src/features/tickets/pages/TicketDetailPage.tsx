import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Lock, Plane, Plus, Send, TriangleAlert } from 'lucide-react';
import { useTicketDetail, useTicketTotals, useTicketTypes } from '../hooks/useTickets';
import { authorizeTicket, TotalsQuery, updateTicket } from '../api/ticketsApi';
import { DynamicForm } from '../components/DynamicForm';
import { StepsTimeline } from '../components/StepsTimeline';
import { TicketsList } from '../components/TicketsList';
import { NewTicketDialog } from '../components/NewTicketDialog';
import { TotalsPanel } from '../components/TotalsPanel';
import { AttachmentsPanel } from '../components/AttachmentsPanel';
import { PassengersPanel } from '../components/PassengersPanel';
import { ClosingPanel } from '../components/ClosingPanel';
import { AuditTimeline } from '@/features/audit/components/AuditTimeline';
import { useEntityAudit } from '@/features/audit/hooks/useAudit';
import { DynamicValues } from '../schemas/dynamicSchema';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { BackLink } from '@/shared/components/navigation/BackLink';
import { Can } from '@/shared/components/auth/Can';
import { useCan } from '@/shared/hooks/useCan';
import { useTypeAccess } from '@/shared/auth/typeAccess';
import { PERMISSIONS } from '@/shared/auth/permissions';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { formatDateTime } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';

export function TicketDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { ticket, children, isLoading, reload: reloadTicket } = useTicketDetail(id);
  const [revision, setRevision] = useState(0);
  const totalsQuery = useMemo<TotalsQuery>(() => ({ parent_id: id }), [id]);
  const { totals } = useTicketTotals(totalsQuery, Boolean(id), revision);
  const { events: auditEvents, reload: reloadAudit } = useEntityAudit('ticket', id);

  /** Toda escritura refresca ticket, totales y bitácora a la vez. */
  const reload = useCallback(() => {
    void reloadTicket();
    reloadAudit();
    setRevision((n) => n + 1);
  }, [reloadTicket, reloadAudit]);
  const { types } = useTicketTypes();
  const { can } = useCan();
  const { canForType } = useTypeAccess();
  const [comment, setComment] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [creatingChild, setCreatingChild] = useState(false);

  if (isLoading || !ticket) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  const type = types.find((x) => x.code === ticket.type_code);
  const childTypes = types.filter((x) => type?.child_type_codes.includes(x.code));
  // Un expediente en estado final es inmutable: el servidor responde 409 a
  // cualquier cambio, así que la pantalla deja de ofrecerlo.
  const isLocked = ticket.status_is_final;
  const canEdit = canForType('edit', ticket.type_code) && !isLocked;

  const onSave = async (values: DynamicValues) => {
    setSubmitting(true);
    const res = await updateTicket(ticket.id, { payload: values });
    setSubmitting(false);
    if (res.ok) {
      notify.toast.success(t('tickets.savedOk'));
      void reload();
      return;
    }
    notify.fromApiError(res);
  };

  const onStatus = async (statusCode: string) => {
    const res = await updateTicket(ticket.id, { status_code: statusCode });
    if (res.ok) {
      void reload();
      return;
    }
    notify.fromApiError(res);
  };

  const onComment = async () => {
    if (!comment.trim()) return;
    const res = await updateTicket(ticket.id, { comment });
    if (res.ok) {
      setComment('');
      void reload();
      return;
    }
    notify.fromApiError(res);
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <BackLink fallback="/tickets" />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle className="data text-xl font-medium tracking-tight">{ticket.code}</CardTitle>
            <Badge variant={ticket.status_color}>{ticket.status_name}</Badge>
          </div>
          <p className="text-base text-muted-foreground">{ticket.title}</p>
          {ticket.control_number && (
            <p className="data text-xs text-muted-foreground">{ticket.control_number}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-muted-foreground">{ticket.type_name}</span>
            {ticket.assigned_role_name && (
              <span className="text-xs text-muted-foreground">· {ticket.assigned_role_name}</span>
            )}
            {ticket.relations.map((r) => (
              <span key={r.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                <Plane className="h-3 w-3" />
                <span className="data">{r.code}</span>
                <span>{r.label}</span>
              </span>
            ))}
            {ticket.parent_code && (
              <Link
                to={`/tickets/${ticket.parent_id}`}
                className="text-xs text-primary hover:underline"
              >
                ← {ticket.parent_code}
              </Link>
            )}
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            {ticket.created_by} · {formatDateTime(ticket.created_at)}
          </p>
        </CardHeader>
      </Card>

      {isLocked && (
        <p className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" />
          {t('tickets.lockedNotice')}
        </p>
      )}

      {type && type.steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="label-strip">{t('tickets.steps')}</CardTitle>
          </CardHeader>
          <CardContent>
            <StepsTimeline
              ticketId={ticket.id}
              steps={type.steps}
              decisions={ticket.decisions}
              canDecide={canEdit}
              canDecideAny={can(PERMISSIONS.ticketsDecideAny)}
              onDecided={reload}
            />
          </CardContent>
        </Card>
      )}

      {type && canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="label-strip">{t('tickets.state')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[...type.statuses]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => void onStatus(status.code)}
                  className={cn(
                    'rounded-full border border-border px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors duration-200 ease-apple hover:border-foreground/25 hover:text-foreground',
                    ticket.status_code === status.code &&
                      'border-primary bg-primary text-primary-foreground',
                  )}
                >
                  {status.name}
                </button>
              ))}
          </CardContent>
        </Card>
      )}

      {ticket.type_is_root && totals && (
        <Card>
          <CardHeader>
            <CardTitle className="label-strip">{t('totals.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <TotalsPanel totals={totals} />
          </CardContent>
        </Card>
      )}

      {ticket.type_is_root && (
        <ClosingPanel ticket={ticket} type={type} canEdit={canEdit} onClosed={reload} />
      )}

      {ticket.type_is_root && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="label-strip">
              {t('tickets.children')} ({children.length})
            </CardTitle>
            {childTypes.length > 0 && !isLocked && (
              <Can permission={PERMISSIONS.ticketsCreate}>
                <Button size="sm" variant="outline" onClick={() => setCreatingChild(true)}>
                  <Plus className="h-4 w-4" />
                  {t('tickets.addChild')}
                </Button>
              </Can>
            )}
          </CardHeader>
          <CardContent>
            <TicketsList items={children} isLoading={false} compact />
          </CardContent>
        </Card>
      )}

      {(ticket.rule_hits?.length ?? 0) > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="label-strip text-warning">{t('tickets.ruleHits')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ticket.rule_hits?.map((hit) => (
              <p key={hit.rule_id} className="flex items-start gap-2 text-sm">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <span>
                  <span className="font-medium">{hit.rule_name}.</span> {hit.message}
                </span>
              </p>
            ))}
            {ticket.rule_hits?.some((h) => h.action === 'require_authorization') && (
              <div className="border-t border-warning/30 pt-3 text-sm">
                {ticket.authorization &&
                ticket.authorization.amount_base === (ticket.money?.amount_base ?? 0) ? (
                  <p data-testid="authorization-stamp">
                    {t('tickets.authorizedBy', {
                      name: ticket.authorization.by,
                      role: ticket.authorization.role,
                      date: formatDateTime(ticket.authorization.at),
                    })}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-muted-foreground">{t('tickets.authorizationPending')}</p>
                    {!isLocked && can(PERMISSIONS.ticketsDecideAny) && (
                      <Button
                        size="sm"
                        data-testid="authorize-button"
                        onClick={async () => {
                          const res = await authorizeTicket(ticket.id);
                          if (res.ok) reload();
                          else notify.fromApiError(res);
                        }}
                      >
                        {t('tickets.authorize')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {ticket.type_is_root && (
        <Card>
          <CardHeader>
            <CardTitle className="label-strip">{t('passengers.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PassengersPanel
              ticketId={ticket.id}
              files={ticket.files}
              readOnly={!canEdit}
              onSaved={reload}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="label-strip">{t('attachments.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentsPanel
            ticketId={ticket.id}
            files={ticket.files}
            readOnly={!canEdit}
            onUploaded={reload}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="label-strip">{t('tickets.data')}</CardTitle>
        </CardHeader>
        <CardContent>
          {type ? (
            <DynamicForm
              fields={type.fields}
              defaultValues={ticket.payload}
              isSubmitting={isSubmitting}
              readOnly={!canEdit}
              onSubmit={onSave}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('tickets.typeMissing')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="label-strip">{t('tickets.comments')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ticket.comments.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-3">
              <p className="text-sm">{c.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.author} · {formatDateTime(c.created_at)}
              </p>
            </div>
          ))}
          {ticket.comments.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('tickets.noComments')}</p>
          )}
          {!isLocked && (
            <div className="flex gap-2">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('tickets.commentPlaceholder')}
                className="min-h-[44px]"
              />
              <Button type="button" size="icon" onClick={() => void onComment()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Can permission={PERMISSIONS.auditView}>
        <Card>
          <CardHeader>
            <CardTitle className="label-strip">{t('audit.ticketTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AuditTimeline events={auditEvents} emptyLabel={t('audit.empty')} />
          </CardContent>
        </Card>
      </Can>

      <NewTicketDialog
        open={creatingChild}
        types={childTypes}
        parentId={ticket.id}
        parentCode={ticket.code}
        onOpenChange={setCreatingChild}
        onCreated={reload}
      />
    </section>
  );
}
