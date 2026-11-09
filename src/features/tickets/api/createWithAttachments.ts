import { ApiResult } from '@/shared/api/types';
import { Ticket } from '../types/ticket.types';
import { AttachmentInput, CreateTicketPayload, createTicket, uploadAttachment } from './ticketsApi';

/**
 * Crea el registro y le cuelga sus soportes, como una sola acción del usuario.
 *
 * Cada paso lleva una clave derivada de la de la acción (`<clave>:a0`, `:a1`…).
 * Si se corta a mitad de camino, repetir la secuencia completa es seguro: el
 * servidor devuelve el registro ya creado y los soportes ya subidos, y solo
 * ejecuta lo que faltó. Por eso la cola puede reintentar sin guardar progreso.
 */
export async function createWithAttachments(
  input: CreateTicketPayload,
  files: AttachmentInput[],
  key: string,
): Promise<ApiResult<Ticket>> {
  let result = await createTicket(input, key);
  if (!result.ok) return result;

  for (const [index, file] of files.entries()) {
    result = await uploadAttachment(result.data.id, file, `${key}:a${index}`);
    if (!result.ok) return result;
  }
  return result;
}
