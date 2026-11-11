import { CatalogItem, CatalogKey } from '../types/catalog.types';
import { getCatalogItems, getUserOptions } from './catalogsApi';

const USER_SOURCE = 'users:';

/** Una fuente de personas se ve como un catálogo: el valor guardado es el nombre. */
async function fetchUserSource(catalog: CatalogKey): Promise<CatalogItem[] | null> {
  const res = await getUserOptions(catalog.slice(USER_SOURCE.length));
  if (!res.ok) return null;
  return res.data.map((o, i) => ({
    id: o.value,
    catalog,
    code: o.value,
    name: o.label,
    is_system: false,
    is_active: true,
    sort_order: i,
  }));
}

const TTL_MS = 60_000;

interface Entry {
  promise: Promise<CatalogItem[] | null>;
  at: number;
}

const entries = new Map<CatalogKey, Entry>();

/**
 * Opciones activas de un catálogo, compartidas por toda la app.
 *
 * Una sola consulta por catálogo dentro del TTL, aunque lo pidan varios
 * componentes a la vez. Un fallo no se cachea (devuelve null).
 */
export function fetchCatalogOptions(catalog: CatalogKey): Promise<CatalogItem[] | null> {
  const hit = entries.get(catalog);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;

  const load = catalog.startsWith(USER_SOURCE)
    ? fetchUserSource(catalog)
    : getCatalogItems({ catalog, is_active: true, limit: 100 }).then((res) =>
        res.ok ? res.data.data : null,
      );
  const promise = load.then((items) => {
    if (items === null && entries.get(catalog)?.promise === promise) entries.delete(catalog);
    return items;
  });
  entries.set(catalog, { promise, at: Date.now() });
  return promise;
}

/** Se llama al crear, editar o borrar un item: la lista cacheada ya no vale. */
export function invalidateCatalogOptions() {
  entries.clear();
}
