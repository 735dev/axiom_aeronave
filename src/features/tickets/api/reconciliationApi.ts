import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully, qs } from '@/shared/api/handlers';
import { ApiResult } from '@/shared/api/types';
import { ClosedPeriod, ReconciliationReport } from '../types/reconciliation.types';

async function call(
  request: () => Promise<{ status: number; data: unknown }>,
  marker: string,
): Promise<ApiResult<ReconciliationReport>> {
  try {
    const res = await request();
    if (isSuccessfully(res.status, res.data, marker)) {
      return { ok: true, data: res.data as ReconciliationReport };
    }
    return handleMessageAxios(res.data as never);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export function getReconciliation(period: string) {
  return call(() => apiAxios.get({ url: `/reconciliation/?${qs({ period })}` }), 'rows');
}

/** Registra por qué se acepta una diferencia. Quien la firma sale del token. */
export function acknowledgeDifference(period: string, key: string, note: string) {
  return call(
    () => apiAxios.post({ url: '/reconciliation/acknowledgements/', data: { period, key, note } }),
    'rows',
  );
}

export function closeReconciliationPeriod(period: string) {
  return call(() => apiAxios.post({ url: '/reconciliation/close/', data: { period } }), 'rows');
}

/** El CSV se arma en el cliente; esto solo deja constancia en la bitácora. */
export async function recordReconciliationExport(
  period: string,
): Promise<ApiResult<{ rows: number }>> {
  try {
    const res = await apiAxios.post({ url: '/reconciliation/export/', data: { period } });
    if (isSuccessfully(res.status, res.data)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

/** Períodos ya cerrados, el más reciente primero. */
export async function getClosedPeriods(): Promise<ApiResult<ClosedPeriod[]>> {
  try {
    const res = await apiAxios.get({ url: '/reconciliation/periods/' });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
