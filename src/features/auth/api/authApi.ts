import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully } from '@/shared/api/handlers';
import { ApiResult } from '@/shared/api/types';
import { AuthUser } from '@/shared/store/slices/authSlice';

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignInResponse {
  token: string;
  refresh_token?: string;
  user: AuthUser;
  permissions: string[];
}

export async function signIn(input: SignInInput): Promise<ApiResult<SignInResponse>> {
  try {
    const res = await apiAxios.post({ url: '/auth/login/', data: { ...input } });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'token')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

/**
 * Avisa al servidor para que invalide los tokens emitidos (sube `tokens_valid_after`).
 * Mejor esfuerzo: sin red, la sesión local se cierra igual.
 */
export async function signOutRemote(): Promise<void> {
  try {
    await apiAxios.post({ url: '/auth/logout/' });
  } catch {
    /* la sesión local ya se cierra */
  }
}

export interface SessionResponse {
  user: AuthUser;
  permissions: string[];
}

/** Revalida la sesión y trae los permisos vigentes del rol. */
export async function getSession(): Promise<ApiResult<SessionResponse>> {
  try {
    const res = await apiAxios.get({ url: '/auth/me/' });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'permissions')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
