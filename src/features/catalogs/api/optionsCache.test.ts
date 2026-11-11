import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./catalogsApi', () => ({
  getCatalogItems: vi.fn(),
  getUserOptions: vi.fn(),
}));

import { getCatalogItems, getUserOptions } from './catalogsApi';
import { fetchCatalogOptions, invalidateCatalogOptions } from './optionsCache';

describe('opciones de catálogo y de personas', () => {
  beforeEach(() => {
    invalidateCatalogOptions();
    vi.clearAllMocks();
  });

  it('una fuente de personas se pide por rol y se ve como catálogo con el nombre como valor', async () => {
    vi.mocked(getUserOptions).mockResolvedValue({
      ok: true,
      data: [{ value: 'Cap. Rodríguez', label: 'Cap. Rodríguez' }],
    });
    const items = await fetchCatalogOptions('users:pilot');
    expect(getUserOptions).toHaveBeenCalledWith('pilot');
    expect(getCatalogItems).not.toHaveBeenCalled();
    expect(items?.map((i) => [i.code, i.name])).toEqual([['Cap. Rodríguez', 'Cap. Rodríguez']]);
  });

  it('un catálogo normal sigue yendo a la lista de catálogos', async () => {
    vi.mocked(getCatalogItems).mockResolvedValue({
      ok: true,
      data: { data: [{ code: 'x', name: 'X' }] },
    } as never);
    const items = await fetchCatalogOptions('fbos');
    expect(getUserOptions).not.toHaveBeenCalled();
    expect(items).toHaveLength(1);
  });

  it('un fallo devuelve null y no se guarda en caché', async () => {
    vi.mocked(getUserOptions).mockResolvedValueOnce({ ok: false } as never);
    expect(await fetchCatalogOptions('users:pilot')).toBeNull();
    vi.mocked(getUserOptions).mockResolvedValueOnce({ ok: true, data: [] });
    expect(await fetchCatalogOptions('users:pilot')).toEqual([]);
    expect(getUserOptions).toHaveBeenCalledTimes(2);
  });
});
