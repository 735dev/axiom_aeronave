import { useReloadOnSync } from '@/shared/offline/syncEvents';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Clock, FileCheck2, PenLine, Printer } from 'lucide-react';
import { ClosingBlocker, ClosingSummary, Ticket, TicketType } from '../types/ticket.types';
import {
  blockersWithoutSignatures,
  signerState,
  signersProgress,
} from '../utils/closingSigners';
import { decideStep, updateTicket } from '../api/ticketsApi';
import { getClosingSummary } from '../api/closingApi';
import { AttachmentImage } from './AttachmentImage';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { formatDateTime } from '@/shared/utils/formatters';
import { cn } from '@/shared/utils/cn';

function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface Props {
  ticket: Ticket;
  type?: TicketType;
  /** El usuario puede editar este tipo y el expediente sigue abierto. */
  canEdit: boolean;
  /** Se llama tras firmar un paso o cerrar, para que la página recargue el ticket. */
  onChanged: () => void;
}

/**
 * Cierre firmado de la operación: reúne en una vista lo que quien firma debe
 * revisar (avance, gasto, soportes, pendientes), recoge la firma de cada
 * responsable y, una vez cerrada, deja el sello. Todo lo calcula el servidor;
 * acá solo se muestra y se disparan las firmas y el cierre.
 */
export function ClosingPanel({ ticket, type, canEdit, onChanged }: Props) {
  const t = useT();
  const [summary, setSummary] = useState<ClosingSummary | null>(null);
  const [signingStep, setSigningStep] = useState<string | null>(null);
  const [isClosing, setClosing] = useState(false);

  const load = useCallback(async () => {
    const res = await getClosingSummary(ticket.id);
    if (res.ok) setSummary(res.data);
  }, [ticket.id]);

  // Se vuelve a pedir cuando el ticket cambia (hijos, decisiones, estado).
  useEffect(() => {
    void load();
  }, [load, ticket.updated_at, ticket.status_code]);

  useReloadOnSync(() => void load());

  if (!summary) return null;

  // La imagen de la firma solo viaja en el resumen de cierre; el ticket trae el sello sin ella.
  const stamp = summary.stamp ?? ticket.closing;
  const hard = blockersWithoutSignatures(summary.blockers, summary.signers);
  const blockerText = (b: ClosingBlocker): string => {
    if (b.kind === 'pending_step')
      return t('closing.blocker.pending_step', { name: b.detail ?? '' });
    if (b.kind === 'receipt_awaiting_validation') {
      return t('closing.blocker.receipt_awaiting_validation', {
        code: b.ticket_code,
        name: b.detail ?? '',
      });
    }
    if (b.kind === 'signature') return t('closing.blocker.signature', { role: b.role_name ?? '' });
    return t(`closing.blocker.${b.kind}`, { code: b.ticket_code });
  };

  const progress = signersProgress(summary.signers);
  // El motivo exacto: cuántos son y cuál es el primero; si no hay pendientes, las firmas que faltan.
  const first = hard[0];
  const reason = first
    ? `${t('closing.reasonBlockers', { count: hard.length })} ${blockerText(first)} ${
        first.ticket_id !== ticket.id ? first.ticket_code : ''
      }`.trim()
    : progress.pending.length > 0
      ? t('closing.reasonSignatures', { count: progress.pending.length })
      : !summary.ready
        ? t('closing.reasonNotReady')
        : undefined;

  const finalStatus = type?.statuses.find((s) => s.is_final && s.counts_as_committed);
  const open = !ticket.status_is_final;
  const showClose = canEdit && open && Boolean(finalStatus);

  const signStep = async (stepCode: string) => {
    setSigningStep(stepCode);
    const signed = await decideStep(ticket.id, { step_code: stepCode, decision: 'done' });
    setSigningStep(null);
    if (!signed.ok) {
      notify.fromApiError(signed);
      return;
    }
    notify.toast.success(t('closing.signedOk'));
    onChanged();
    void load();
  };

  const closeOperation = async () => {
    if (!finalStatus) return;
    setClosing(true);
    const closed = await updateTicket(ticket.id, { status_code: finalStatus.code });
    setClosing(false);
    if (closed.ok) {
      notify.toast.success(t('closing.closedOk'));
      onChanged();
      return;
    }
    notify.fromApiError(closed);
    void load();
  };

  const docLabel = (docType: string) => {
    const key = `closing.docTypes.${docType}`;
    const label = t(key);
    return label === key ? docType : label;
  };

  const base = summary.totals.base_currency;

  return (
    <Card data-testid="closing-panel" className="print:border-0 print:shadow-none">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="label-strip flex items-center gap-2">
          <FileCheck2 className="h-4 w-4" />
          {t('closing.title')}
        </CardTitle>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="print:hidden"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          {t('closing.print')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {stamp && (
          <div
            data-testid="closing-stamp"
            className="space-y-4 rounded-lg border border-success/40 bg-success/5 p-4 print:break-inside-avoid"
          >
            {stamp.signatures && stamp.signatures.length > 0 ? (
              <ul
                data-testid="closing-signatures"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                {stamp.signatures.map((sig) => (
                  <li
                    key={sig.step_code}
                    data-testid="closing-signature"
                    className="space-y-1.5 text-center print:break-inside-avoid"
                  >
                    <div className="flex h-20 items-center justify-center rounded-md bg-white p-2">
                      <img
                        src={sig.signature_url}
                        alt={`${t('users.signatureOf')} ${sig.user_name}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <p className="label-strip">{sig.role_name}</p>
                    <p className="text-sm font-medium">{sig.user_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(sig.signed_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                <div className="flex h-24 w-48 items-center justify-center rounded-md bg-white p-2">
                  {stamp.signature_url && (
                    <img
                      src={stamp.signature_url}
                      alt={t('closing.stampSignature')}
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {t('closing.signedBy', { name: stamp.signed_by, role: stamp.signed_role })}
                  </p>
                  <p className="text-muted-foreground">{formatDateTime(stamp.signed_at)}</p>
                </div>
              </div>
            )}
            <div className="space-y-1 text-sm">
              <p className="data">
                {t('closing.stampTotals', {
                  amount: money(stamp.totals.committed_base, stamp.totals.base_currency),
                })}
              </p>
              <p className="text-muted-foreground">
                {t('closing.stampFiles', { count: stamp.files_count })} ·{' '}
                <span className="data">{stamp.folder}</span>
              </p>
            </div>
          </div>
        )}

        {open && summary.signers.length > 0 && (
          <section className="space-y-2" data-testid="closing-signers">
            <h3 className="label-strip">
              {t('closing.signatures')} ({progress.signed}/{progress.total})
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {summary.signers.map((sg) => {
                const state = signerState(sg);
                return (
                  <li
                    key={sg.step_code}
                    data-testid={`signer-${sg.step_code}`}
                    data-state={state}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border p-3',
                      state === 'signed' ? 'border-success/40 bg-success/5' : 'border-border',
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      {state === 'signed' ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      ) : (
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">{sg.role_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{sg.step_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {sg.signed
                            ? `${sg.signed_by_name ?? ''} · ${sg.signed_at ? formatDateTime(sg.signed_at) : ''}`
                            : t('closing.signerPending')}
                        </p>
                        {state === 'mine' && !sg.has_signature && (
                          <p className="text-xs text-warning">
                            {t('closing.reasonNoSignature')}{' '}
                            <Link to="/perfil" className="text-primary hover:underline">
                              {t('closing.goToProfile')}
                            </Link>
                          </p>
                        )}
                      </div>
                    </div>
                    {state === 'mine' && (
                      <Button
                        type="button"
                        size="sm"
                        data-testid={`sign-${sg.step_code}`}
                        className="shrink-0 print:hidden"
                        disabled={!sg.has_signature || signingStep !== null}
                        onClick={() => void signStep(sg.step_code)}
                      >
                        <PenLine className="h-4 w-4" />
                        {t('closing.sign')}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="label-strip">{t('closing.progress')}</h3>
          <ul className="space-y-3">
            {summary.progress.map((row) => {
              const pct = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
              return (
                <li key={row.role_id ?? 'none'} data-testid="closing-progress-row">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span>{row.role_name}</span>
                    <span className="data text-muted-foreground">
                      {row.done}/{row.total}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={row.role_name}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full',
                        pct === 100 ? 'bg-success' : 'bg-primary',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {row.pending.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('closing.pending')}: {row.pending.join(' · ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="label-strip">{t('closing.expenses')}</h3>
          {summary.expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('closing.noExpenses')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('closing.col.code')}</th>
                    <th className="px-3 py-2 font-medium">{t('closing.col.concept')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('closing.col.amount')}</th>
                    <th className="px-3 py-2 text-right font-medium">{base}</th>
                    <th className="px-3 py-2 font-medium">{t('closing.col.status')}</th>
                    <th className="px-3 py-2 font-medium">{t('closing.col.support')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.expenses.map((row) => (
                    <tr key={row.ticket_id} className={cn(!row.counts && 'text-muted-foreground')}>
                      <td className="data px-3 py-2">
                        <Link to={`/tickets/${row.ticket_id}`} className="hover:underline">
                          {row.code}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{row.concept}</td>
                      <td className="data px-3 py-2 text-right">
                        {money(row.amount, row.currency)}
                      </td>
                      <td className="data px-3 py-2 text-right">{money(row.amount_base, base)}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">
                        {row.has_support ? t('closing.yes') : t('closing.no')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2" data-testid="closing-totals">
            {(
              [
                ['confirmed', summary.confirmed],
                ['inProgress', summary.in_progress],
              ] as const
            ).map(([key, block]) => (
              <div key={key} className="rounded-lg border border-border bg-muted/60 p-3">
                <p className="label-strip">{t(`closing.${key}`)}</p>
                <p className="data mt-1 text-lg font-semibold">{money(block.base, base)}</p>
                <p className="data text-xs text-muted-foreground">
                  {block.by_currency.length === 0
                    ? '—'
                    : block.by_currency.map((c) => money(c.amount, c.currency)).join(' + ')}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="label-strip">
            {t('closing.supports')} ({summary.supports.length})
          </h3>
          {summary.supports.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('closing.noSupports')}</p>
          )}
          {summary.supports_by_type.map(({ document_type, count }) => (
            <div key={document_type} data-testid="closing-support-group">
              <p className="text-sm font-medium">
                {docLabel(document_type)}{' '}
                <span className="data text-muted-foreground">({count})</span>
              </p>
              <ul className="mt-1 grid gap-2 sm:grid-cols-2">
                {summary.supports
                  .filter((s) => s.document_type === document_type)
                  .map((s) => (
                    <li
                      key={s.file_id}
                      className="flex items-center gap-3 rounded-md border border-border p-2 print:break-inside-avoid"
                    >
                      {s.mime.startsWith('image/') ? (
                        <AttachmentImage
                          ticketId={s.ticket_id}
                          fileId={s.file_id}
                          name={s.name}
                          zoom
                          className="h-12 w-12 rounded"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted text-[10px] uppercase text-muted-foreground">
                          {s.name.split('.').pop()}
                        </span>
                      )}
                      <span className="min-w-0 text-xs">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="block truncate text-muted-foreground">
                          {s.ticket_code} · {kb(s.size)} · {s.uploaded_by}
                        </span>
                        <span className="data block truncate text-muted-foreground">
                          {s.folder}/{s.filename}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>

        {!ticket.status_is_final && (
          <section className="space-y-2" data-testid="closing-blockers">
            <h3 className="label-strip">{t('closing.blockers')}</h3>
            {hard.length === 0 ? (
              <p className={cn('text-sm', progress.pending.length === 0 ? 'text-success' : 'text-muted-foreground')}>
                {progress.pending.length === 0 ? t('closing.noBlockers') : t('closing.onlySignatures')}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {hard.map((b, i) => (
                  <li
                    key={`${b.kind}-${b.ticket_id}-${i}`}
                    className="flex items-start gap-2 text-sm"
                  >
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>
                      {blockerText(b)}{' '}
                      {b.ticket_id !== ticket.id && (
                        <Link
                          to={`/tickets/${b.ticket_id}`}
                          className="data text-primary hover:underline"
                        >
                          {b.ticket_code}
                        </Link>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {showClose && (
          <div className="space-y-2 border-t border-border pt-4 print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                data-testid="close-operation"
                disabled={Boolean(reason) || !summary.ready || isClosing}
                onClick={() => void closeOperation()}
              >
                <FileCheck2 className="h-4 w-4" />
                {t('closing.close')}
              </Button>
              {reason && (
                <p data-testid="closing-reason" className="text-sm text-muted-foreground">
                  {reason}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
