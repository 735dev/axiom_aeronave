import { ApiResult } from '@/shared/api/types';
import { isNetworkFailure, isOnline as networkOnline } from './network';
import { emitSynced } from './syncEvents';

/**
 * Cola de envíos pendientes para cuando no hay señal.
 *
 * Solo admite acciones que se pueden diferir sin riesgo: cargar un soporte o
 * crear un registro de trabajo. Nunca decisiones, firmas ni cierres: una firma
 * que viaja horas después sin que el usuario lo sepa es peor que un error a la
 * vista.
 */
export type QueuedKind = 'create_ticket' | 'upload_attachment' | 'update_ticket';

export interface QueuedItem {
  /** Clave de idempotencia. Es también el identificador del elemento. */
  key: string;
  kind: QueuedKind;
  /** Dueño del envío. Otro usuario en el mismo teléfono no lo dispara. */
  userId: string;
  /** Texto para mostrar qué quedó pendiente. */
  label: string;
  createdAt: string;
  attempts: number;
  /** `failed`: el servidor lo rechazó. No se reintenta solo ni se descarta solo. */
  state: 'pending' | 'failed';
  error?: string;
  /** `attachments`: soportes que viajan junto al registro que se crea. */
  request: { ticketId?: string; body: unknown; attachments?: unknown[] };
}

export interface QueueStore {
  all(): Promise<QueuedItem[]>;
  put(item: QueuedItem): Promise<void>;
  remove(key: string): Promise<void>;
}

export type Sender = (item: QueuedItem) => Promise<ApiResult<unknown>>;

export interface FlushReport {
  sent: number;
  failed: number;
  remaining: number;
  /** Se cortó porque no hay red o la sesión venció. */
  interrupted: boolean;
}

type Listener = (items: QueuedItem[]) => void;

/** Sin respuesta, o fallo del servidor que puede ser pasajero. */
function isTransient(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

export class OfflineQueue {
  private listeners = new Set<Listener>();
  private flushing: Promise<FlushReport> | null = null;

  constructor(
    private readonly store: QueueStore,
    private readonly send: Sender,
  ) {}

  async list(userId: string): Promise<QueuedItem[]> {
    const all = await this.store.all();
    return all
      .filter((i) => i.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async enqueue(item: Omit<QueuedItem, 'attempts' | 'state' | 'createdAt'>): Promise<void> {
    await this.store.put({
      ...item,
      attempts: 0,
      state: 'pending',
      createdAt: new Date().toISOString(),
    });
    await this.emit(item.userId);
  }

  async discard(userId: string, key: string): Promise<void> {
    await this.store.remove(key);
    await this.emit(userId);
  }

  /** Devuelve a pendiente lo que el servidor rechazó, para volver a intentarlo. */
  async retryFailed(userId: string): Promise<void> {
    const items = await this.list(userId);
    await Promise.all(
      items
        .filter((i) => i.state === 'failed')
        .map((i) => this.store.put({ ...i, state: 'pending' })),
    );
    await this.emit(userId);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Envía en orden lo pendiente del usuario. Dos llamadas simultáneas comparten la corrida. */
  flush(userId: string): Promise<FlushReport> {
    if (!this.flushing) {
      this.flushing = this.run(userId).finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async run(userId: string): Promise<FlushReport> {
    const report: FlushReport = { sent: 0, failed: 0, remaining: 0, interrupted: false };
    const pending = (await this.list(userId)).filter((i) => i.state === 'pending');

    for (const item of pending) {
      const result = await this.send(item);

      if (result.ok) {
        await this.store.remove(item.key);
        report.sent += 1;
        continue;
      }

      // Sin red o con la sesión vencida no tiene sentido seguir con el resto.
      if (isTransient(result.status) || result.status === 401) {
        await this.store.put({ ...item, attempts: item.attempts + 1, error: result.detail });
        report.interrupted = true;
        break;
      }

      // El servidor lo rechazó: reintentar daría lo mismo. Queda a la vista
      // para que una persona decida; descartarlo en silencio perdería el dato.
      await this.store.put({
        ...item,
        attempts: item.attempts + 1,
        state: 'failed',
        error: result.detail,
      });
      report.failed += 1;
    }

    report.remaining = (await this.list(userId)).length;
    await this.emit(userId);
    // Lo enviado cambió datos del servidor: las vistas que los muestran deben releerlos.
    if (report.sent > 0) emitSynced(report.sent);
    return report;
  }

  private async emit(userId: string): Promise<void> {
    if (this.listeners.size === 0) return;
    const items = await this.list(userId);
    this.listeners.forEach((l) => l(items));
  }
}

export type SubmitOutcome<T> = { queued: true } | { queued: false; result: ApiResult<T> };

/**
 * Intenta el envío y, si no hay señal, lo deja en la cola con la MISMA clave.
 *
 * Un tiempo de espera agotado cuenta como "sin respuesta": el servidor pudo
 * haber recibido la petición. Por eso el reintento reutiliza la clave.
 */
export async function submitOrQueue<T>(
  queue: OfflineQueue,
  item: Omit<QueuedItem, 'attempts' | 'state' | 'createdAt'>,
  attempt: () => Promise<ApiResult<T>>,
  isOnline: () => boolean = networkOnline,
): Promise<SubmitOutcome<T>> {
  if (isOnline()) {
    // Una excepción (no solo un resultado) también es "no llegó": se encola igual.
    const result = await attempt().catch((): ApiResult<T> => ({
      ok: false,
      status: 0,
      title: 'errors.network',
      detail: 'errors.network',
    }));
    if (!isNetworkFailure(result)) return { queued: false, result };
  }
  await queue.enqueue(item);
  return { queued: true };
}
