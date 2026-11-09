import { useEffect, useRef } from 'react';

/**
 * Aviso de "la cola terminó de enviar algo". Las vistas que muestran datos del
 * servidor (tickets, avisos, cierre) se suscriben y vuelven a pedirlos, para
 * que lo recién sincronizado aparezca sin que la persona recargue.
 */
type Listener = (sent: number) => void;
const listeners = new Set<Listener>();

export function onSynced(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSynced(sent: number) {
  listeners.forEach((l) => l(sent));
}

/** Ejecuta `reload` cada vez que la cola sincroniza algo. */
export function useReloadOnSync(reload: () => void, enabled = true) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    if (!enabled) return;
    return onSynced(() => ref.current());
  }, [enabled]);
}
