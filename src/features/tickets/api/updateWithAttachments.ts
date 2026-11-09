import { ApiResult } from '@/shared/api/types';
import { Ticket } from '../types/ticket.types';
import { AttachmentInput, UpdateTicketPayload, updateTicket, uploadAttachment } from './ticketsApi';

/**
 * Actualiza un registro existente y le cuelga soportes, como una sola acción.
 *
 * El PATCH es idempotente por naturaleza (mismos valores, mismo resultado) y
 * cada soporte lleva `<clave>:aN`, igual que en `createWithAttachments`: la
 * cola puede repetir toda la secuencia sin duplicar nada.
 */
export async function updateWithAttachments(
  ticketId: string,
  input: UpdateTicketPayload,
  files: AttachmentInput[],
  key: string,
): Promise<ApiResult<Ticket>> {
  // Un estado final cierra el registro y ya no admite soportes: se aplica al último.
  const { status_code: finalStatus, ...data } = input;
  let result = await updateTicket(ticketId, data);
  if (!result.ok) return result;

  for (const [index, file] of files.entries()) {
    result = await uploadAttachment(ticketId, file, `${key}:a${index}`);
    if (!result.ok) return result;
  }
  if (finalStatus) result = await updateTicket(ticketId, { status_code: finalStatus });
  return result;
}
