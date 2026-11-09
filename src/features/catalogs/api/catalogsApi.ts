import { apiAxios } from '@/shared/api/api';
import { handleErrorAxios, handleMessageAxios, isSuccessfully, qs } from '@/shared/api/handlers';
import { ApiResult, Paginated } from '@/shared/api/types';
import { CatalogDefinition, CatalogItem, CatalogKey } from '../types/catalog.types';

export interface CatalogItemsQuery {
  catalog: CatalogKey;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

export interface CatalogItemPayload {
  catalog: CatalogKey;
  code?: string;
  name: string;
  extra?: string;
}

export async function getCatalogs(): Promise<ApiResult<CatalogDefinition[]>> {
  try {
    const res = await apiAxios.get({ url: '/catalogs/' });
    if (isSuccessfully(res.status)) return { ok: true, data: res.data };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function getCatalogItems(
  params: CatalogItemsQuery,
): Promise<ApiResult<Paginated<CatalogItem>>> {
  try {
    const res = await apiAxios.get({ url: `/catalog-items/?${qs({ ...params })}` });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'links')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function createCatalogItem(input: CatalogItemPayload): Promise<ApiResult<CatalogItem>> {
  try {
    const res = await apiAxios.post({ url: '/catalog-items/', data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function updateCatalogItem(
  id: string,
  input: Partial<CatalogItemPayload> & { is_active?: boolean },
): Promise<ApiResult<CatalogItem>> {
  try {
    const res = await apiAxios.patch({ url: `/catalog-items/${id}/`, data: { ...input } as never });
    const body = res.data;
    if (isSuccessfully(res.status, body, 'id')) return { ok: true, data: body };
    return handleMessageAxios(body);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}

export async function deleteCatalogItem(id: string): Promise<ApiResult<{ deleted: true }>> {
  try {
    const res = await apiAxios.delete({ url: `/catalog-items/${id}/` });
    if (res.status === 204) return { ok: true, data: { deleted: true } };
    return handleMessageAxios(res.data);
  } catch (e) {
    return handleErrorAxios(e as never);
  }
}
