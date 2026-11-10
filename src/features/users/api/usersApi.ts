import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully, qs } from '@/shared/api/handlers';
import { ApiResult, Paginated } from '@/shared/api/types';
import { ImportResult } from '@/shared/utils/importRows';
import { AppUser } from '../types/user.types';

export interface UsersQuery {
  q?: string;
  is_active?: boolean;
  role_id?: string;
  location?: string;
  aircraft_id?: string;
  page?: number;
  limit?: number;
}

export interface UserPayload {
  full_name: string;
  email: string;
  phone?: string;
  role_id: string;
  aircraft_id?: string;
  location?: string;
  granted_permissions?: string[];
  revoked_permissions?: string[];
}

export async function getUsers(params: UsersQuery): Promise<ApiResult<Paginated<AppUser>>> {
  try {
    const res = await apiAxios.get({ url: `/users/?${qs({ ...params })}` });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'links')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function createUser(input: UserPayload): Promise<ApiResult<AppUser>> {
  try {
    const res = await apiAxios.post({ url: '/users/', data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function updateUser(
  id: string,
  input: Partial<UserPayload> & { is_active?: boolean },
): Promise<ApiResult<AppUser>> {
  try {
    const res = await apiAxios.patch({ url: `/users/${id}/`, data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export interface UserImportRow {
  full_name: string;
  email: string;
  phone: string;
  role_code: string;
  location: string;
  aircraft_id: string;
}

/** `dryRun` valida sin escribir; la contraseña inicial la decide el servidor. */
export async function importUsers(
  rows: Record<string, string>[],
  dryRun: boolean,
): Promise<ApiResult<ImportResult>> {
  try {
    const res = await apiAxios.post({
      url: '/users/import/',
      data: { rows, dry_run: dryRun } as never,
    });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'errors')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
