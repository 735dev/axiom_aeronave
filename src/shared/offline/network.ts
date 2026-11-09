import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { ApiResult } from '@/shared/api/types';

/**
 * Única fuente de verdad de "hay red".
 *
 * En Android con modo avión el WebView sigue diciendo `navigator.onLine ===
 * true`, así que en nativo manda el plugin de Capacitor; en web, el navegador.
 * Aun así ninguna de las dos es definitiva: un envío que falla sin respuesta
 * (ver `isNetworkFailure`) también cuenta como "sin red".
 */
type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();
let current: boolean | null = null;
let started = false;

function webOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function set(next: boolean) {
  if (current === next) return;
  current = next;
  listeners.forEach((l) => l(next));
}

/** Estado actual, síncrono. Antes de conocer el del plugin se usa el del navegador. */
export function isOnline(): boolean {
  start();
  return current ?? webOnline();
}

/** Avisa cada vez que cambia el estado de la red. Devuelve la baja. */
export function onNetworkChange(listener: Listener): () => void {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Una petición que no llegó al servidor: sin conexión, caída de DNS o tiempo agotado. */
export function isNetworkFailure(result: ApiResult<unknown>): boolean {
  return !result.ok && result.status === 0;
}

/** Marca manualmente el estado (pruebas, o una señal externa). */
export function setOnlineForTests(value: boolean | null) {
  current = value;
}

function start() {
  if (started) return;
  started = true;
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => set(true));
    window.addEventListener('offline', () => set(false));
  }
  if (Capacitor.isNativePlatform()) {
    void Network.getStatus()
      .then((s) => set(s.connected))
      .catch(() => undefined);
    void Network.addListener('networkStatusChange', (s) => set(s.connected));
  }
}
