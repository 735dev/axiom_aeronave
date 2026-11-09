import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully, qs } from '@/shared/api/handlers';
import { ApiResult, Paginated } from '@/shared/api/types';
import { AppUser } from '../types/user.types';

export interface UsersQuery {
  q?: string;
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
