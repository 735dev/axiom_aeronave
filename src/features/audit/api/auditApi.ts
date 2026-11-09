import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully, qs } from '@/shared/api/handlers';
import { ApiResult, Paginated } from '@/shared/api/types';
import { AuditEvent, AuditFilters } from '../types/audit.types';

export interface AuditQuery extends AuditFilters {
  page?: number;
  limit?: number;
}

/** La bitácora solo se lee. No hay endpoints de escritura ni de borrado. */
export async function getAuditEvents(
  params: AuditQuery,
): Promise<ApiResult<Paginated<AuditEvent>>> {
  try {
    const res = await apiAxios.get({ url: `/audit/?${qs({ ...params })}` });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'links')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
