import { useCallback, useEffect, useState } from 'react';
import { useAppSelector } from '@/shared/store/hooks';
import { QueuedItem } from '@/shared/offline/queue';
import { notify } from '@/shared/utils/notify';
import { useT } from '@/shared/hooks/useT';
import { isOnline, onNetworkChange } from '@/shared/offline/network';
import { offlineQueue } from '../queue';

/**
 * Dos disparos casi simultáneos (al montar y al volver la red) comparten una
 * misma corrida de la cola y reciben el mismo informe: se avisa una sola vez.
 */
const reported = new WeakSet<object>();

/** Mientras haya pendientes se reintenta cada tanto, además de al volver la señal. */
const RETRY_MS = 30_000;

/**
 * Mantiene viva la cola: carga lo pendiente del usuario, reintenta al volver la
 * red, al abrir la app y periódicamente mientras quede algo.
 */
export function useOfflineSync() {
  const t = useT();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [items, setItems] = useState<QueuedItem[]>([]);
  const [isSyncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(isOnline);

  useEffect(() => onNetworkChange(setOnline), []);

  const flush = useCallback(async () => {
    if (!userId || !isOnline()) return;
    setSyncing(true);
    try {
      const report = await offlineQueue.flush(userId);
      if (reported.has(report)) return;
      reported.add(report);
      if (report.sent > 0) notify.toast.success(t('offline.synced', { count: report.sent }));
      if (report.failed > 0) notify.toast.error(t('offline.rejected', { count: report.failed }));
    } finally {
      setSyncing(false);
    }
  }, [userId, t]);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    void offlineQueue.list(userId).then(setItems);
    const unsubscribe = offlineQueue.subscribe(setItems);
    void flush();
    const offNetwork = onNetworkChange((online) => {
      if (online) void flush();
    });
    const timer = window.setInterval(() => {
      void offlineQueue.list(userId).then((list) => {
        if (list.some((i) => i.state === 'pending')) void flush();
      });
    }, RETRY_MS);
    return () => {
      unsubscribe();
      offNetwork();
      window.clearInterval(timer);
    };
  }, [userId, flush]);

  const retryFailed = useCallback(async () => {
    if (!userId) return;
    await offlineQueue.retryFailed(userId);
    await flush();
  }, [userId, flush]);

  const discard = useCallback(
    async (key: string) => {
      if (userId) await offlineQueue.discard(userId, key);
    },
    [userId],
  );

  return { items, isSyncing, online, flush, retryFailed, discard };
}
