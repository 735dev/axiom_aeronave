import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully } from '@/shared/api/handlers';
import { ApiResult } from '@/shared/api/types';
import { ClosingSummary } from '../types/ticket.types';

/** Resumen de cierre del expediente: solo existe para tickets raíz. */
export async function getClosingSummary(id: string): Promise<ApiResult<ClosingSummary>> {
  try {
    const res = await apiAxios.get({ url: `/tickets/${id}/closing/` });
    if (isSuccessfully(res.status, res.data, 'ticket_id')) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
