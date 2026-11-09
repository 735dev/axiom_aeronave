import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Send } from 'lucide-react';
import { AttachmentInput, getTickets } from '../api/ticketsApi';
import { PendingFiles } from '../components/PendingFiles';
import { useTicketTypes } from '../hooks/useTickets';
import { Ticket } from '../types/ticket.types';
import {
  EMPTY_FORM,
  FINDING_CHIPS,
  MAX_NOTE,
  QUICK_LOG_TYPE,
  QuickLogForm,
  appendFinding,
  buildQuickLogInput,
  findOpenReport,
  nowAsTime,
  pickDefaultOperation,
  submitQuickLog,
  validateQuickLog,
} from './quickLog';
import { Button } from '@/shared/components/ui/button';
import { Select } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { useT } from '@/shared/hooks/useT';
import { useAuth } from '@/shared/hooks/useAuth';
import { useTypeAccess } from '@/shared/auth/typeAccess';
import { notify } from '@/shared/utils/notify';
import { cn } from '@/shared/utils/cn';
import { newIdempotencyKey } from '@/shared/offline/idempotency';
import { offlineQueue } from '@/features/offline/queue';

const TIME_INPUT =
  'h-14 w-full min-w-0 rounded-lg border border-input bg-secondary px-3 text-xl font-semibold focus-visible:border-ring focus-visible:bg-background';

/**
 * Bitácora rápida: salida, llegada y novedad en pocos toques, desde el teléfono.
 * Objetivos táctiles grandes y nada de párrafos: lo que se escribe es una nota corta.
 */
export function QuickLogPage() {
  const t = useT();
  const { user } = useAuth();
  const { canForType } = useTypeAccess();
  const { types } = useTicketTypes({ is_active: true });
  const type = types.find((x) => x.code === QUICK_LOG_TYPE);

  const [operations, setOperations] = useState<Ticket[]>([]);
  const [form, setForm] = useState<QuickLogForm>(EMPTY_FORM);
  const [files, setFiles] = useState<AttachmentInput[]>([]);
  const [errors, setErrors] = useState<ReturnType<typeof validateQuickLog>>({});
  const [isSubmitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<Ticket | undefined>();
  const [saved, setSaved] = useState<Ticket | null>(null);
  // Mismo contenido = misma clave: un segundo toque tras un corte no duplica.
  const attempt = useRef<{ sig: string; key: string } | null>(null);

  useEffect(() => {
    void getTickets({ is_root: true, open: true, limit: 100 }).then((res) => {
      if (!res.ok) {
        notify.fromApiError(res);
        return;
      }
      const list = res.data.data;
      setOperations(list);
      const initial = pickDefaultOperation(list, user?.aircraft_id);
      if (initial)
        setForm((prev) => (prev.operationId ? prev : { ...prev, operationId: initial.id }));
    });
  }, [user?.aircraft_id]);

  // El reporte abierto de la operación elegida: la bitácora lo completa.
  useEffect(() => {
    setExisting(undefined);
    if (!form.operationId) return;
    let cancelled = false;
    void getTickets({
      parent_id: form.operationId,
      type_code: QUICK_LOG_TYPE,
      open: true,
      limit: 50,
    }).then((res) => {
      if (!cancelled && res.ok) setExisting(findOpenReport(res.data.data));
    });
    return () => {
      cancelled = true;
    };
  }, [form.operationId, saved]);

  const set = (patch: Partial<QuickLogForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(null);
    setErrors({});
  };

  const parent = operations.find((o) => o.id === form.operationId);
  const allowed = canForType('create', QUICK_LOG_TYPE);

  const onSave = async () => {
    const found = validateQuickLog(form);
    setErrors(found);
    if (Object.keys(found).length > 0 || !parent || !type) return;

    const input = buildQuickLogInput(form, type, parent);
    const sig = JSON.stringify([input, existing?.id, files.map((f) => f.name + f.size)]);
    if (attempt.current?.sig !== sig) attempt.current = { sig, key: newIdempotencyKey() };

    setSubmitting(true);
    const outcome = await submitQuickLog(
      {
        queue: offlineQueue,
        userId: user?.id ?? '',
        label: `${t('quicklog.title')} · ${parent.code}`,
        existing,
      },
      input,
      files,
      attempt.current.key,
    );
    setSubmitting(false);

    if (outcome.queued) {
      notify.toast.warning(t('offline.queued'));
    } else if (outcome.result.ok) {
      notify.toast.success(t('quicklog.saved'));
      setSaved(outcome.result.data);
    } else {
      notify.fromApiError(outcome.result);
      return;
    }
    attempt.current = null;
    setForm({ ...EMPTY_FORM, operationId: form.operationId });
    setFiles([]);
  };

  const timeRow = (field: 'departure' | 'arrival', label: string, error: string | undefined) => (
    <div className="space-y-1.5">
      <label className="label-strip" htmlFor={`quicklog-${field}`}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={`quicklog-${field}`}
          data-testid={`quicklog-${field}`}
          type="time"
          className={TIME_INPUT}
          value={form[field]}
          onChange={(e) => set({ [field]: e.target.value })}
        />
        <Button
          type="button"
          variant="outline"
          className="h-14 shrink-0 px-4"
          data-testid={`quicklog-${field}-now`}
          onClick={() => set({ [field]: nowAsTime() })}
        >
          <Clock className="h-5 w-5" />
          {t('quicklog.now')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );

  if (type && !allowed) {
    return <p className="p-6 text-sm text-muted-foreground">{t('quicklog.noAccess')}</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 p-4 pb-8 md:p-6">
      <h1 className="text-2xl font-extrabold">{t('quicklog.title')}</h1>

      <div className="space-y-1.5">
        <label className="label-strip" htmlFor="quicklog-operation">
          {t('quicklog.operation')}
        </label>
        <Select
          id="quicklog-operation"
          data-testid="quicklog-operation"
          className="h-14 text-base"
          value={form.operationId}
          onChange={(e) => set({ operationId: e.target.value })}
        >
          <option value="">{t('quicklog.pickOperation')}</option>
          {operations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} · {o.title}
            </option>
          ))}
        </Select>
        {errors.operation && (
          <p role="alert" className="text-sm text-destructive">
            {t(errors.operation)}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {timeRow('departure', t('quicklog.departure'), errors.departure)}
        {timeRow('arrival', t('quicklog.arrival'), errors.arrival)}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={form.nextDay}
        data-testid="quicklog-nextday"
        onClick={() => set({ nextDay: !form.nextDay })}
        className={cn(
          'flex h-12 w-full items-center justify-between rounded-lg border border-border px-4 text-sm font-medium',
          form.nextDay && 'border-primary bg-accent text-primary',
        )}
      >
        {t('quicklog.nextDay')}
        <span>{form.nextDay ? t('common.yes') : t('common.no')}</span>
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={form.hasFinding}
        data-testid="quicklog-finding"
        onClick={() => set({ hasFinding: !form.hasFinding })}
        className={cn(
          'flex h-14 w-full items-center justify-between rounded-lg border border-border px-4 text-base font-semibold',
          form.hasFinding && 'border-warning bg-warning/10 text-warning',
        )}
      >
        {t('quicklog.finding')}
        <span>{form.hasFinding ? t('common.yes') : t('common.no')}</span>
      </button>

      {form.hasFinding && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {FINDING_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                data-testid={`quicklog-chip-${chip}`}
                onClick={() => {
                  const next = appendFinding(form.note, t(`quicklog.chips.${chip}`));
                  if (next === null) notify.toast.warning(t('quicklog.errors.noteTooLong'));
                  else set({ note: next });
                }}
                className="h-11 rounded-full border border-border bg-secondary px-4 text-sm font-medium"
              >
                {t(`quicklog.chips.${chip}`)}
              </button>
            ))}
          </div>
          <Textarea
            data-testid="quicklog-note"
            maxLength={MAX_NOTE}
            rows={3}
            value={form.note}
            placeholder={t('quicklog.notePlaceholder')}
            onChange={(e) => set({ note: e.target.value })}
          />
          <p className="text-right text-xs text-muted-foreground">
            {form.note.length}/{MAX_NOTE}
          </p>
          {errors.note && (
            <p role="alert" className="text-sm text-destructive">
              {t(errors.note)}
            </p>
          )}
        </div>
      )}

      <PendingFiles files={files} onChange={setFiles} disabled={isSubmitting} />

      <Button
        type="button"
        data-testid="quicklog-save"
        className="h-14 w-full text-base"
        disabled={isSubmitting}
        onClick={() => void onSave()}
      >
        <Send className="h-5 w-5" />
        {t('quicklog.save')}
      </Button>

      {saved?.parent_id && (
        <Link
          to={`/tickets/${saved.parent_id}`}
          className="block text-center text-sm font-medium text-primary underline"
        >
          {t('quicklog.viewFile', { code: saved.parent_code ?? '' })}
        </Link>
      )}
    </div>
  );
}
