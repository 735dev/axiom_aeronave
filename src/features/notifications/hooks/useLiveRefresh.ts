import { useEffect, useRef } from 'react';
import { NOTIFICATIONS_CHANGED } from '../api/notificationsApi';

export const NOTIFICATIONS_POLL_MS = 30_000;

/**
 * Mantiene vivos los avisos sin depender de que el usuario recargue: sondea
 * cada 30 s, refresca al volver a la pestaña y cuando otra vista marca algo.
 */
export function useLiveRefresh(refresh: () => void, enabled = true) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const run = () => latest.current();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    const timer = window.setInterval(onVisible, NOTIFICATIONS_POLL_MS);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED, run);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED, run);
    };
  }, [enabled]);
}
