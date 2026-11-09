import { toast } from 'sonner';
import { getStoreRef } from '@/shared/store';
import { showInfoModal } from '@/shared/store/slices/uiSlice';
import { ApiError } from '@/shared/api/types';

class ConfirmRegistry {
  private map = new Map<string, () => void>();
  register(fn: () => void) {
    const id = crypto.randomUUID();
    this.map.set(id, fn);
    return id;
  }
  run(id: string) {
    const fn = this.map.get(id);
    if (fn) fn();
    this.map.delete(id);
  }
}
export const confirmRegistry = new ConfirmRegistry();

export const notify = {
  success: (description: string, code = 200) =>
    getStoreRef()?.dispatch(showInfoModal({ type: 'success', description, code })),
  error: (description: string, code = 400) =>
    getStoreRef()?.dispatch(showInfoModal({ type: 'error', description, code })),
  warning: (description: string, code = 400) =>
    getStoreRef()?.dispatch(showInfoModal({ type: 'warning', description, code })),
  confirm: (description: string, onConfirm: () => void) => {
    const confirmActionId = confirmRegistry.register(onConfirm);
    getStoreRef()?.dispatch(showInfoModal({ type: 'confirm', description, confirmActionId }));
  },
  toast: {
    success: (msg: string, desc?: string) => toast.success(msg, { description: desc }),
    error: (msg: string, desc?: string) => toast.error(msg, { description: desc }),
    warning: (msg: string, desc?: string) => toast.warning(msg, { description: desc }),
    info: (msg: string, desc?: string) => toast.info(msg, { description: desc }),
  },
  fromApiError: (err: ApiError) => {
    if (err.status === 422) {
      toast.error(err.detail);
      return;
    }
    getStoreRef()?.dispatch(
      showInfoModal({
        type: err.status >= 500 ? 'error' : 'warning',
        description: err.detail,
        code: err.status,
      }),
    );
  },
};
