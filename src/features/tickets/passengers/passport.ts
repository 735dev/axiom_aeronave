import { ApiResult } from '@/shared/api/types';
import { newIdempotencyKey } from '@/shared/offline/idempotency';
import { AttachmentInput, savePassengers, uploadAttachment } from '../api/ticketsApi';
import { Attachment, Passenger, Ticket } from '../types/ticket.types';

/** Campo de archivo que Blackbox clasifica como pasaporte. */
export const PASSPORT_FIELD_KEY = 'passport';
/** Categoría de Blackbox del manifiesto firmado (campo `manifest` del tipo). */
export const MANIFEST_DOCUMENT_TYPE = 'manifiesto';

/** Soportes del manifiesto firmado en el aeropuerto, el más reciente primero. */
export function manifestFiles(files: Attachment[]): Attachment[] {
  return files
    .filter((f) => f.document_type === MANIFEST_DOCUMENT_TYPE)
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
}

/** El archivo recién subido es el que no estaba antes: el servidor no devuelve su id aparte. */
export function addedFile(before: Attachment[], after: Attachment[]): Attachment | undefined {
  const known = new Set(before.map((f) => f.id));
  return after.filter((f) => !known.has(f.id)).at(-1);
}

/**
 * Sube el pasaporte de un pasajero y lo enlaza en el manifiesto.
 *
 * Se guarda el manifiesto completo en el mismo paso: una foto subida y no
 * enlazada quedaría huérfana entre los soportes sin que nadie sepa de quién es.
 */
export async function attachPassport(
  ticket: Pick<Ticket, 'id' | 'files'>,
  rows: Passenger[],
  index: number,
  file: AttachmentInput,
): Promise<ApiResult<Passenger[]>> {
  const row = rows[index];
  if (!row) throw new Error('Pasajero inexistente');
  const uploaded = await uploadAttachment(
    ticket.id,
    { ...file, field_key: PASSPORT_FIELD_KEY },
    newIdempotencyKey(),
  );
  if (!uploaded.ok) return uploaded;

  const added = addedFile(ticket.files, uploaded.data.files);
  if (!added) {
    return { ok: false, status: 500, title: 'errors.serverTitle', detail: 'errors.serverDetail' };
  }
  const next = rows
    .map((r, i) => (i === index ? { ...r, passport_file_id: added.id } : r))
    .filter((r) => r.full_name.trim() && r.document.trim());
  return savePassengers(ticket.id, next);
}
