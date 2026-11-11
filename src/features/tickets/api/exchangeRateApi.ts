import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully } from '@/shared/api/handlers';
import { ApiResult } from '@/shared/api/types';

export interface ExchangeRate {
  /** Bolívares por dólar. */
  rate: number;
  source: string;
  /** Fecha (AAAA-MM-DD) de la tasa publicada, si la fuente la informó. */
  effective_date: string | null;
  fetched_at: string;
}

/** Tasa oficial del día. Falla (503) si la fuente no responde: se escribe a mano. */
export async function getExchangeRate(): Promise<ApiResult<ExchangeRate>> {
  try {
    const res = await apiAxios.get({ url: '/exchange-rate/' });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
