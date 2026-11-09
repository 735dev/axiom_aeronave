import { CircleCheckBig, MessageCircleQuestion, TriangleAlert, XCircleIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { hideInfoModal } from '@/shared/store/slices/uiSlice';
import { useT } from '@/shared/hooks/useT';
import { confirmRegistry } from '@/shared/utils/notify';

export function DisplayMessage() {
  const t = useT();
  const dispatch = useAppDispatch();
  const m = useAppSelector((s) => s.ui.infoModal);

  const close = () => dispatch(hideInfoModal());

  return (
    <Dialog open={m.open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center">
            {m.type === 'error' && <XCircleIcon className="text-red-500" strokeWidth={1} size={88} />}
            {m.type === 'success' && <CircleCheckBig className="text-emerald-500" strokeWidth={1} size={88} />}
            {m.type === 'warning' && <TriangleAlert className="text-amber-500" strokeWidth={1} size={88} />}
            {m.type === 'confirm' && <MessageCircleQuestion className="text-blue-500" strokeWidth={1} size={88} />}
          </div>
          <DialogTitle className="text-center text-xl">
            {t(`errors.title.${m.code ?? 'generic'}`)}
          </DialogTitle>
          <DialogDescription className="text-center">{t(m.description)}</DialogDescription>
        </DialogHeader>

        {m.type === 'confirm' && (
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (m.confirmActionId) confirmRegistry.run(m.confirmActionId);
                close();
              }}
            >
              {t('common.confirm')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
