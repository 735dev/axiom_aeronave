import { apiAxios } from '@/shared/api/api';
import { IDEMPOTENCY_HEADER } from '@/shared/offline/idempotency';
import { handleErrorAxios, handleMessageAxios, isSuccessfully, qs } from '@/shared/api/handlers';
import { ApiResult, Paginated } from '@/shared/api/types';
import { env } from '@/shared/config/env';
import { uploadBody } from '@/shared/api/upload';
import {
  Attachment,
  BusinessRule,
  DecisionValue,
  ExpenseTotals,
  Extraction,
  Passenger,
  Relation,
  Ticket,
  TicketType,
} from '../types/ticket.types';

export interface TicketsQuery {
  q?: string;
  status_code?: string;
  type_code?: string;
  parent_id?: string;
  assigned_role_id?: string;
  /** "Mis misiones": lo asignado a quien consulta o, sin responsable puntual, a su rol. */
  mine?: boolean;
  is_root?: boolean;
  open?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateTicketPayload {
  type_code: string;
  title: string;
  parent_id?: string;
  assigned_role_id?: string;
  assigned_user_id?: string;
  due_at?: string;
  relations?: Relation[];
  payload: Record<string, unknown>;
}

export interface UpdateTicketPayload {
  status_code?: string;
  payload?: Record<string, unknown>;
  assigned_role_id?: string;
  comment?: string;
}

export interface DecisionPayload {
  step_code: string;
  decision: DecisionValue;
  observation?: string;
}

export async function getTickets(params: TicketsQuery): Promise<ApiResult<Paginated<Ticket>>> {
  try {
    const res = await apiAxios.get({ url: `/tickets/?${qs({ ...params })}` });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'links')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function getTicket(id: string): Promise<ApiResult<Ticket>> {
  try {
    const res = await apiAxios.get({ url: `/tickets/${id}/` });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function createTicket(
  input: CreateTicketPayload,
  idempotencyKey?: string,
): Promise<ApiResult<Ticket>> {
  try {
    const res = await apiAxios.post({
      url: '/tickets/',
      data: { ...input } as never,
      config: idempotencyKey ? { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } } : undefined,
    });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function updateTicket(
  id: string,
  input: UpdateTicketPayload,
): Promise<ApiResult<Ticket>> {
  try {
    const res = await apiAxios.patch({ url: `/tickets/${id}/`, data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function decideStep(id: string, input: DecisionPayload): Promise<ApiResult<Ticket>> {
  try {
    const res = await apiAxios.post({ url: `/tickets/${id}/decisions/`, data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export interface TicketTypesQuery {
  is_active?: boolean;
  is_root?: boolean;
}

export async function getTicketTypes(
  params: TicketTypesQuery = {},
): Promise<ApiResult<TicketType[]>> {
  try {
    const res = await apiAxios.get({ url: `/ticket-types/?${qs({ ...params })}` });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export interface TicketTypePayload {
  name: string;
  code?: string;
  description?: string;
  is_root: boolean;
  child_type_codes: string[];
  default_role_id?: string;
  blocks_parent_close: boolean;
  relation_kinds: string[];
  fields: unknown[];
  statuses: unknown[];
  steps: unknown[];
}

export async function createTicketType(input: TicketTypePayload): Promise<ApiResult<TicketType>> {
  try {
    const res = await apiAxios.post({ url: '/ticket-types/', data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function updateTicketType(
  id: string,
  input: Partial<TicketTypePayload> & { is_active?: boolean },
): Promise<ApiResult<TicketType>> {
  try {
    const res = await apiAxios.patch({ url: `/ticket-types/${id}/`, data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function deleteTicketType(id: string): Promise<ApiResult<{ deleted: true }>> {
  try {
    const res = await apiAxios.delete({ url: `/ticket-types/${id}/` });
    if (res.status === 204) return { ok: true, data: { deleted: true } };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export interface TotalsQuery {
  type_code?: string;
  parent_id?: string;
  status_code?: string;
  aircraft?: string;
  from?: string;
  to?: string;
  is_root?: 'true' | 'false';
}

/**
 * Los totales los calcula el backend con el mismo criterio que la lista.
 * Sumar en el cliente daría un número distinto en cuanto haya paginación.
 */
export async function getTicketTotals(params: TotalsQuery): Promise<ApiResult<ExpenseTotals>> {
  try {
    const res = await apiAxios.get({ url: `/tickets/totals/?${qs({ ...params })}` });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'base_currency')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export interface AttachmentInput {
  name: string;
  mime: string;
  size: number;
  data_url: string;
  /** Qué campo de archivo del tipo justifica este soporte (define su categoría). */
  field_key?: string;
}

export interface AttachmentLink {
  url: string;
  expires_at: string;
}

/** Pide un enlace de descarga del original. Vence en minutos: no se guarda. */
export async function getAttachmentLink(
  ticketId: string,
  fileId: string,
): Promise<ApiResult<AttachmentLink>> {
  try {
    const res = await apiAxios.get({ url: `/tickets/${ticketId}/attachments/${fileId}/download/` });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'url')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function uploadAttachment(
  ticketId: string,
  file: AttachmentInput,
  idempotencyKey?: string,
): Promise<ApiResult<Ticket>> {
  try {
    const res = await apiAxios.post({
      url: `/tickets/${ticketId}/attachments/`,
      data: uploadBody(file, { field_key: file.field_key }) as never,
      config: idempotencyKey ? { headers: { [IDEMPOTENCY_HEADER]: idempotencyKey } } : undefined,
    });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

/** Lee un comprobante antes de crear el registro, para proponer el renglón ya cargado. */
export async function readReceipt(
  typeCode: string,
  file: AttachmentInput,
): Promise<ApiResult<Extraction>> {
  try {
    const res = await apiAxios.post({
      url: '/attachments/extract/',
      // El servidor lee los bytes de la imagen; el simulador solo el nombre y el tamaño.
      data: (env.useMocks
        ? { type_code: typeCode, name: file.name, mime: file.mime, size: file.size }
        : uploadBody(file, { type_code: typeCode })) as never,
    });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'status')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function validateAttachment(
  ticketId: string,
  fileId: string,
  fields: { key: string; value: string | number }[],
  confirmed: string[] = [],
): Promise<ApiResult<Ticket>> {
  try {
    const res = await apiAxios.post({
      url: `/tickets/${ticketId}/attachments/${fileId}/validate/`,
      data: { fields, confirmed } as never,
    });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export interface PendingReview {
  ticket_id: string;
  ticket_code: string;
  ticket_title: string;
  type_name: string;
  parent_code?: string;
  file: Attachment;
}

export async function getPendingReviews(params: {
  page?: number;
  limit?: number;
}): Promise<ApiResult<Paginated<PendingReview>>> {
  try {
    const res = await apiAxios.get({ url: `/attachments/pending/?${qs({ ...params })}` });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'links')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function getRules(): Promise<ApiResult<BusinessRule[]>> {
  try {
    const res = await apiAxios.get({ url: '/rules/' });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'length')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function createRule(data: Partial<BusinessRule>): Promise<ApiResult<BusinessRule>> {
  try {
    const res = await apiAxios.post({ url: '/rules/', data: data as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function updateRule(
  id: string,
  data: Partial<BusinessRule>,
): Promise<ApiResult<BusinessRule>> {
  try {
    const res = await apiAxios.patch({ url: `/rules/${id}/`, data: data as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

/** El manifiesto no viaja dentro del ticket: es su propio recurso. */
export async function getPassengers(ticketId: string): Promise<ApiResult<Passenger[]>> {
  try {
    const res = await apiAxios.get({ url: `/tickets/${ticketId}/passengers/` });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

/** Reemplaza el manifiesto completo. El servidor fija id, posición y claves de búsqueda. */
export async function savePassengers(
  ticketId: string,
  passengers: Passenger[],
): Promise<ApiResult<Passenger[]>> {
  try {
    const res = await apiAxios.put({
      url: `/tickets/${ticketId}/passengers/`,
      data: {
        passengers: passengers.map((p) => ({
          full_name: p.full_name,
          document: p.document,
          nationality: p.nationality || undefined,
          passport_file_id: p.passport_file_id || undefined,
        })),
      } as never,
    });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

/** Visto bueno de la dirección sobre un gasto que una regla marcó. */
export async function authorizeTicket(id: string, note?: string): Promise<ApiResult<Ticket>> {
  try {
    const res = await apiAxios.post({ url: `/tickets/${id}/authorize/`, data: { note } });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
