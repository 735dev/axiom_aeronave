import { AttachmentInput, uploadAttachment } from '@/features/tickets/api/ticketsApi';
import { createWithAttachments } from '@/features/tickets/api/createWithAttachments';
import { updateWithAttachments } from '@/features/tickets/api/updateWithAttachments';
import { OfflineQueue, QueuedItem } from '@/shared/offline/queue';
import { createIdbStore, createMemoryStore } from '@/shared/offline/idbStore';

function buildStore() {
  if (typeof indexedDB !== 'undefined') return createIdbStore();
  // Sin IndexedDB lo pendiente se pierde al recargar: que quede dicho.
  console.warn('[offline] IndexedDB no disponible: la cola vive solo en memoria.');
  return createMemoryStore();
}

/** Reenvía un elemento con la misma clave con que se intentó la primera vez. */
function sendQueued(item: QueuedItem) {
  if (item.kind === 'create_ticket') {
    return createWithAttachments(
      item.request.body as Parameters<typeof createWithAttachments>[0],
      (item.request.attachments ?? []) as AttachmentInput[],
      item.key,
    );
  }
  if (item.kind === 'update_ticket') {
    return updateWithAttachments(
      item.request.ticketId ?? '',
      item.request.body as Parameters<typeof updateWithAttachments>[1],
      (item.request.attachments ?? []) as AttachmentInput[],
      item.key,
    );
  }
  return uploadAttachment(
    item.request.ticketId ?? '',
    item.request.body as Parameters<typeof uploadAttachment>[1],
    item.key,
  );
}

export const offlineQueue = new OfflineQueue(buildStore(), sendQueued);
