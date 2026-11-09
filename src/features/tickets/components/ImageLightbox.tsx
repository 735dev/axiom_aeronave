import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';

interface Props {
  src?: string;
  title: string;
  onClose: () => void;
}

/** Vista ampliada de un soporte: a 64 px un ticket térmico no se lee. */
export function ImageLightbox({ src, title, onClose }: Props) {
  return (
    <Dialog open={Boolean(src)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto">
        <DialogHeader>
          <DialogTitle className="truncate text-sm">{title}</DialogTitle>
        </DialogHeader>
        {src && <img src={src} alt={title} className="mx-auto max-h-[75vh] w-auto" />}
      </DialogContent>
    </Dialog>
  );
}
