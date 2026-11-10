import { useEffect, useState } from 'react';
import { AttachmentInput, readReceipt } from '../api/ticketsApi';
import { createWithAttachments } from '../api/createWithAttachments';
import { PendingFiles } from './PendingFiles';
import { DynamicForm } from './DynamicForm';
import { Extraction, TicketType } from '../types/ticket.types';
import { DynamicValues } from '../schemas/dynamicSchema';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { useTypeAccess } from '@/shared/auth/typeAccess';
import { notify } from '@/shared/utils/notify';
import { cn } from '@/shared/utils/cn';
import { useAppSelector } from '@/shared/store/hooks';
import { newIdempotencyKey } from '@/shared/offline/idempotency';
import { submitOrQueue } from '@/shared/offline/queue';
import { offlineQueue } from '@/features/offline/queue';

interface Props {
  open: boolean;
  types: TicketType[];
  parentId?: string;
  parentCode?: string;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewTicketDialog({
  open,
  types,
  parentId,
  parentCode,
  onOpenChange,
  onCreated,
}: Props) {
  const t = useT();
  const userId = useAppSelector((st) => st.auth.user?.id);
  const { canForType } = useTypeAccess();
  const [selected, setSelected] = useState<TicketType | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<AttachmentInput[]>([]);
  const [proposal, setProposal] = useState<Extraction | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();

  // Con la primera foto el sistema lee el comprobante y propone el renglón.
  // Si no puede (ilegible, sin señal) la carga sigue siendo manual, sin trabar.
  const firstImage = files.find((f) => f.mime.startsWith('image/'));
  useEffect(() => {
    if (!selected || !firstImage || selected.is_root) {
      setProposal(undefined);
      return;
    }
    let cancelled = false;
    void readReceipt(selected.code, firstImage).then((res) => {
      if (cancelled) return;
      setProposal(res.ok && res.data.status === 'extracted' ? res.data : undefined);
      if (res.ok && res.data.status === 'unreadable')
        notify.toast.warning(t('tickets.readUnreadable'));
      // Sin lectura la carga sigue siendo manual, pero la persona debe saber por qué no hubo propuesta.
      if (!res.ok && res.status === 429) notify.toast.warning(t('errors.tooManyDetail'));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, firstImage?.name, firstImage?.size]);

  const available = types.filter((type) => type.is_active && canForType('create', type.code));

  const close = () => {
    setSelected(null);
    setFieldErrors(undefined);
    setFiles([]);
    setProposal(undefined);
    onOpenChange(false);
  };

  const onSubmit = async (values: DynamicValues) => {
    if (!selected) return;
    setSubmitting(true);
    const input = {
      type_code: selected.code,
      title: parentCode ? `${selected.name} · ${parentCode}` : selected.name,
      parent_id: parentId,
      assigned_role_id: selected.default_role_id,
      payload: values,
    };
    const key = newIdempotencyKey();
    // Una operación raíz no se difiere: su numeración correlativa la decide el
    // servidor y tiene que verla el resto del equipo al momento.
    const outcome = selected.is_root
      ? { queued: false as const, result: await createWithAttachments(input, files, key) }
      : await submitOrQueue(
          offlineQueue,
          {
            key,
            kind: 'create_ticket',
            userId: userId ?? '',
            label:
              `${t('offline.kindCreate')}: ${selected.name}${parentCode ? ` · ${parentCode}` : ''}` +
              (files.length > 0 ? ` · ${t('offline.withFiles', { count: files.length })}` : ''),
            request: { body: input, attachments: files },
          },
          () => createWithAttachments(input, files, key),
        );
    setSubmitting(false);
    if (outcome.queued) {
      notify.toast.warning(t('offline.queued'));
      close();
      return;
    }
    const res = outcome.result;
    if (res.ok) {
      notify.toast.success(t('tickets.createdOk'));
      onCreated();
      close();
      return;
    }
    setFieldErrors(res.fieldErrors ? { ...res.fieldErrors } : undefined);
    notify.fromApiError(res);
    // Si falló al subir un soporte, el registro ya pudo haberse creado.
    if (files.length > 0) onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selected ? selected.name : t('tickets.new')}</DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="grid gap-2 pt-4 sm:grid-cols-2">
            {available.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelected(type)}
                className={cn(
                  'rounded-lg border border-border p-3 text-left hover:border-primary hover:bg-muted',
                )}
              >
                <p className="text-sm font-medium">{type.name}</p>
                {type.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{type.description}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {type.fields.length} {t('ticketTypes.fieldsShort')}
                  {type.default_role_name ? ` · ${type.default_role_name}` : ''}
                </p>
              </button>
            ))}
            {available.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                {t('tickets.noTypes')}
              </p>
            )}
          </div>
        ) : (
          <div className="pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-3"
              onClick={() => setSelected(null)}
            >
              ‹ {t('common.back')}
            </Button>
            {!selected.is_root && (
              <PendingFiles files={files} onChange={setFiles} disabled={isSubmitting} />
            )}
            <DynamicForm
              fields={selected.fields}
              isSubmitting={isSubmitting}
              proposal={proposal}
              serverErrors={fieldErrors}
              onSubmit={onSubmit}
              onCancel={close}
              submitLabel="tickets.create"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
