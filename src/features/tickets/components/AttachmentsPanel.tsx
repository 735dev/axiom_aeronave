import { useRef, useState } from 'react';
import { Camera, Check, Paperclip, ScanLine, TriangleAlert } from 'lucide-react';
import { uploadAttachment } from '../api/ticketsApi';
import { AttachmentImage } from './AttachmentImage';
import { AttachmentRejected, MAX_FILES_PER_RECORD, toAttachmentInput } from '../utils/prepareFile';
import { capturePhoto } from '../utils/capturePhoto';
import { Attachment } from '../types/ticket.types';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { formatDateTime } from '@/shared/utils/formatters';
import { useAppSelector } from '@/shared/store/hooks';
import { newIdempotencyKey } from '@/shared/offline/idempotency';
import { submitOrQueue } from '@/shared/offline/queue';
import { offlineQueue } from '@/features/offline/queue';

interface Props {
  ticketId: string;
  files: Attachment[];
  readOnly?: boolean;
  onUploaded: () => void;
}

interface Chain {
  key: string;
  count: number;
}

/**
 * La sesión de captura sobrevive al remonte: subir una foto recarga el detalle
 * del ticket, que desmonta este panel, y sin esto la cadena se perdería en
 * cada foto.
 */
const chains = new Map<string, Chain>();

export function AttachmentsPanel({ ticketId, files, readOnly, onUploaded }: Props) {
  const t = useT();
  const userId = useAppSelector((st) => st.auth.user?.id);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setUploading] = useState(false);
  /** Sesión de captura encadenada: una clave base y cuántas fotos lleva. */
  const [chain, setChainState] = useState<Chain | null>(() => chains.get(ticketId) ?? null);
  const setChain = (next: Chain | null) => {
    if (next) chains.set(ticketId, next);
    else chains.delete(ticketId);
    setChainState(next);
  };

  /** Envía un archivo. Devuelve true si salió o quedó en cola (no se perdió). */
  const send = async (file: File | undefined, key = newIdempotencyKey()): Promise<boolean> => {
    if (!file) return false;
    setUploading(true);
    try {
      const input = await toAttachmentInput(file, (report) => {
        if (report.path === 'full' && file.type.startsWith('image/')) {
          notify.toast.info(t('attachments.scanFull'));
        }
      });
      const outcome = await submitOrQueue(
        offlineQueue,
        {
          key,
          kind: 'upload_attachment',
          userId: userId ?? '',
          label: `${t('offline.kindUpload')}: ${file.name}`,
          request: { ticketId, body: input },
        },
        () => uploadAttachment(ticketId, input, key),
      );
      if (outcome.queued) {
        notify.toast.warning(t('offline.queued'));
        return true;
      }
      const res = outcome.result;
      if (!res.ok) {
        notify.fromApiError(res);
        return false;
      }
      notify.toast.success(t('attachments.uploaded'));
      onUploaded();
      return true;
    } catch (e) {
      notify.toast.error(
        e instanceof AttachmentRejected ? t(e.messageKey, e.vars) : t('attachments.failed'),
      );
      return false;
    } finally {
      setUploading(false);
    }
  };

  /**
   * Captura con la cámara sin volver al menú: cada foto lleva su propia clave
   * derivada (`${key}:a${i}`), así un reintento de la cola no duplica ninguna.
   */
  const capture = async (file: File | undefined) => {
    if (!file) return;
    const session = chain ?? { key: newIdempotencyKey(), count: 0 };
    if (files.length + session.count >= MAX_FILES_PER_RECORD) {
      notify.toast.warning(t('attachments.tooMany', { count: MAX_FILES_PER_RECORD }));
      setChain(null);
      return;
    }
    const ok = await send(file, `${session.key}:a${session.count}`);
    // Una foto fallida no consume turno: se reintenta con la misma clave.
    setChain(ok ? { key: session.key, count: session.count + 1 } : chain);
  };

  const openCamera = () =>
    capturePhoto(
      capture,
      () => cameraRef.current?.click(),
      () => notify.toast.error(t('attachments.cameraDenied')),
    ).catch(() => notify.toast.error(t('attachments.failed')));

  const chainFull = chain !== null && files.length + chain.count >= MAX_FILES_PER_RECORD;

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-2"
            >
              {file.mime.startsWith('image/') ? (
                <AttachmentImage
                  ticketId={ticketId}
                  fileId={file.id}
                  name={file.name}
                  zoom
                  className="h-14 w-14 shrink-0 rounded-md border border-border"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{file.name}</p>
                <p className="data text-xs text-muted-foreground">
                  {file.uploaded_by} · {formatDateTime(file.uploaded_at)}
                </p>
              </div>
              {file.extraction?.status === 'extracted' && (
                <Badge variant="warning">
                  <ScanLine className="h-3 w-3" />
                  {t('attachments.pendingReview')}
                </Badge>
              )}
              {file.extraction?.status === 'validated' && (
                <Badge variant="success">
                  <Check className="h-3 w-3" />
                  {t('attachments.validated')}
                </Badge>
              )}
              {file.extraction?.status === 'unreadable' && (
                <Badge variant="danger">
                  <TriangleAlert className="h-3 w-3" />
                  {t('attachments.unreadable')}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {/* `capture` abre la cámara en el teléfono y se ignora en escritorio. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            data-testid="attach-camera-input"
            className="hidden"
            onChange={(e) => {
              void capture(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            data-testid="attach-file-input"
            className="hidden"
            onChange={(e) => {
              void send(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button size="sm" disabled={isUploading} onClick={() => void openCamera()}>
            <Camera className="h-4 w-4" />
            {t('attachments.capture')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isUploading}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            {t('attachments.fromFile')}
          </Button>
        </div>
      )}

      {!readOnly && chain && chain.count > 0 && (
        <div
          data-testid="capture-chain"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted p-2"
        >
          <span className="data text-sm">
            {t('attachments.chainCount', { count: chain.count })}
          </span>
          <Button size="sm" disabled={isUploading || chainFull} onClick={() => void openCamera()}>
            <Camera className="h-4 w-4" />
            {t('attachments.another')}
          </Button>
          <Button size="sm" variant="outline" disabled={isUploading} onClick={() => setChain(null)}>
            <Check className="h-4 w-4" />
            {t('attachments.done')}
          </Button>
        </div>
      )}

      {files.length === 0 && readOnly && (
        <p className="text-sm text-muted-foreground">{t('attachments.empty')}</p>
      )}
    </div>
  );
}
