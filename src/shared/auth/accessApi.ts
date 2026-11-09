import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully } from '@/shared/api/handlers';
import { ApiResult } from '@/shared/api/types';

export interface RoleOption {
  id: string;
  name: string;
}

export interface PermissionOption {
  code: string;
  name: string;
  module_code: string;
}

/**
 * Lecturas de roles y permisos que necesitan varias features.
 * Vive en shared para no cruzar imports entre features.
 */
export async function getRoleOptions(): Promise<ApiResult<RoleOption[]>> {
  try {
    const res = await apiAxios.get({ url: '/roles/?limit=100' });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'links')) {
      return {
        ok: true,
        data: (body.data as Array<{ id: string; name: string; is_active: boolean }>)
          .filter((r) => r.is_active)
          .map((r) => ({ id: r.id, name: r.name })),
      };
    }
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function getPermissionOptions(): Promise<ApiResult<PermissionOption[]>> {
  try {
    const res = await apiAxios.get({ url: '/permissions/' });
    if (isSuccessfully(res.status)) {
      return {
        ok: true,
        data: (res.data as PermissionOption[]).map((p) => ({
          code: p.code,
          name: p.name,
          module_code: p.module_code,
        })),
      };
    }
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export interface MenuModule {
  id: string;
  code: string;
  name: string;
  route?: string;
  icon?: string;
  menu_permission?: string;
  show_in_menu: boolean;
  sort_order: number;
  is_active: boolean;
}

export async function getMenuModules(): Promise<ApiResult<MenuModule[]>> {
  try {
    const res = await apiAxios.get({ url: '/modules/' });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
