import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully } from '@/shared/api/handlers';
import { ApiResult } from '@/shared/api/types';

export interface MySignature {
  signature_url: string | null;
}

export async function getMySignature(): Promise<ApiResult<MySignature>> {
  try {
    const res = await apiAxios.get({ url: '/auth/me/signature/' });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

/** Sube, reemplaza (data URL) o quita (`null`) la firma del usuario en sesión. */
export async function setMySignature(dataUrl: string | null): Promise<ApiResult<MySignature>> {
  try {
    const res = await apiAxios.patch({
      url: '/auth/me/signature/',
      data: { signature_url: dataUrl ?? '' },
    });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
