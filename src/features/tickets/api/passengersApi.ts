import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully, qs } from '@/shared/api/handlers';
import { ApiResult } from '@/shared/api/types';

export interface PassengerOperation {
  id: string;
  code: string;
  date: string;
  route: string;
  status_code: string;
  status_name: string;
  status_is_final: boolean;
}

export interface PassengerMatch {
  document: string;
  full_name: string;
  nationality?: string;
  passport?: { ticket_id: string; file_id: string };
  operations: PassengerOperation[];
}

/**
 * En qué operaciones viajó una persona. Un 404 es "sin acceso" o "sin datos":
 * al usuario le llega igual, una lista vacía, para no confirmar que existen.
 */
export async function searchPassengers(q: string): Promise<ApiResult<PassengerMatch[]>> {
  try {
    const res = await apiAxios.get({ url: `/passengers/search/?${qs({ q })}` });
    const body = res.data as { data?: PassengerMatch[] };
    if (isSuccessfully(res.status, body, 'data')) return { ok: true, data: body.data ?? [] };
    return handleMessageAxios(body as never);
  } catch (e) {
    const err = handleErrorAxios(e as never);
    if (err.status === 404) return { ok: true, data: [] };
    return err;
  }
}
