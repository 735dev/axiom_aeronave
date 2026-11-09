import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useAttachmentUrl } from '../hooks/useAttachmentUrl';
import { ImageLightbox } from './ImageLightbox';
import { cn } from '@/shared/utils/cn';

interface Props {
  ticketId: string;
  fileId: string;
  name: string;
  className?: string;
  /** Con `zoom` el toque abre la imagen a tamaño completo. */
  zoom?: boolean;
}

/** Imagen de un soporte guardado en Blackbox, con su enlace firmado al día. */
export function AttachmentImage({ ticketId, fileId, name, className, zoom }: Props) {
  const { url, failed } = useAttachmentUrl(ticketId, fileId);
  const [open, setOpen] = useState(false);

  if (failed) {
    return (
      <span className={cn('flex items-center justify-center bg-muted', className)} title={name}>
        <ImageOff className="h-5 w-5 text-muted-foreground" />
      </span>
    );
  }
  if (!url) return <span className={cn('animate-pulse bg-muted', className)} aria-hidden />;

  const image = <img src={url} alt={name} className={cn('object-cover', className)} />;
  if (!zoom) return image;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0" aria-label={name}>
        {image}
      </button>
      <ImageLightbox src={open ? url : undefined} title={name} onClose={() => setOpen(false)} />
    </>
  );
}
