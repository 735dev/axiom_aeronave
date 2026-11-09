import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully, qs } from '@/shared/api/handlers';
import { ApiResult, Paginated } from '@/shared/api/types';
import { Module, Permission, Role } from '../types/role.types';

export interface RolesQuery {
  q?: string;
  page?: number;
  limit?: number;
}

export interface RoleInputPayload {
  name: string;
  description?: string;
  permissions: string[];
}

export async function getRoles(params: RolesQuery): Promise<ApiResult<Paginated<Role>>> {
  try {
    const res = await apiAxios.get({ url: `/roles/?${qs({ ...params })}` });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'links')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export interface ModulePayload {
  name: string;
  code?: string;
  description?: string;
  route?: string;
  icon?: string;
  menu_permission?: string;
  show_in_menu?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

export async function getModules(): Promise<ApiResult<Module[]>> {
  try {
    const res = await apiAxios.get({ url: '/modules/' });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function getPermissions(): Promise<ApiResult<Permission[]>> {
  try {
    const res = await apiAxios.get({ url: '/permissions/' });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function createRole(input: RoleInputPayload): Promise<ApiResult<Role>> {
  try {
    const res = await apiAxios.post({ url: '/roles/', data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function updateRole(
  id: string,
  input: Partial<RoleInputPayload> & { is_active?: boolean },
): Promise<ApiResult<Role>> {
  try {
    const res = await apiAxios.patch({ url: `/roles/${id}/`, data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function deleteRole(id: string): Promise<ApiResult<{ deleted: true }>> {
  try {
    const res = await apiAxios.delete({ url: `/roles/${id}/` });
    if (res.status === 204) return { ok: true, data: { deleted: true } };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}






export async function updateModule(id: string, input: ModulePayload): Promise<ApiResult<Module>> {
  try {
    const res = await apiAxios.patch({ url: `/modules/${id}/`, data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
