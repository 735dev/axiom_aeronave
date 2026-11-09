import { useRef, useState } from 'react';
import { Camera, Paperclip, X } from 'lucide-react';
import { AttachmentInput } from '../api/ticketsApi';
import { AttachmentRejected, MAX_FILES_PER_RECORD, toAttachmentInput } from '../utils/prepareFile';
import { capturePhoto } from '../utils/capturePhoto';
import { ImageLightbox } from './ImageLightbox';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';

interface Props {
  files: AttachmentInput[];
  onChange: (files: AttachmentInput[]) => void;
  disabled?: boolean;
}

/**
 * Soportes que se eligen al crear el registro, antes de que exista.
 *
 * Es lo que permite fotografiar el comprobante y crear el gasto en un solo
 * paso, también sin señal: el registro y su foto viajan juntos en la cola.
 */
export function PendingFiles({ files, onChange, disabled }: Props) {
  const t = useT();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPreparing, setPreparing] = useState(false);
  const [zoomed, setZoomed] = useState<AttachmentInput | null>(null);

  const add = async (file: File | undefined) => {
    if (!file) return;
    if (files.length >= MAX_FILES_PER_RECORD) {
      notify.toast.warning(t('attachments.tooMany', { count: MAX_FILES_PER_RECORD }));
      return;
    }
    setPreparing(true);
    try {
      onChange([...files, await toAttachmentInput(file)]);
    } catch (e) {
      notify.toast.error(
        e instanceof AttachmentRejected ? t(e.messageKey, e.vars) : t('attachments.failed'),
      );
    } finally {
      setPreparing(false);
    }
  };

  const openCamera = () =>
    capturePhoto(
      add,
      () => cameraRef.current?.click(),
      () => notify.toast.error(t('attachments.cameraDenied')),
    ).catch(() => notify.toast.error(t('attachments.failed')));

  return (
    <div className="mb-4 space-y-2">
      <p className="label-strip">{t('attachments.optionalTitle')}</p>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="relative">
              {file.mime.startsWith('image/') ? (
                <button type="button" onClick={() => setZoomed(file)} aria-label={file.name}>
                  <img
                    src={file.data_url}
                    alt={file.name}
                    className="h-16 w-16 rounded-md border border-border object-cover"
                  />
                </button>
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-md border border-border bg-muted">
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                </span>
              )}
              <button
                type="button"
                aria-label={t('attachments.remove')}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ImageLightbox
        src={zoomed?.data_url}
        title={zoomed?.name ?? ''}
        onClose={() => setZoomed(null)}
      />

      <div className="flex flex-wrap gap-2">
        {/* `capture` abre la cámara en el teléfono y se ignora en escritorio. */}
        <input
          ref={cameraRef}
          data-testid="pending-camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void add(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={fileRef}
          data-testid="pending-file-input"
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            void add(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={disabled || isPreparing}
          onClick={() => void openCamera()}
        >
          <Camera className="h-4 w-4" />
          {t('attachments.capture')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || isPreparing}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
          {t('attachments.fromFile')}
        </Button>
      </div>
    </div>
  );
}
