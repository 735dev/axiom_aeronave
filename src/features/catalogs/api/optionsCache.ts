import { CatalogItem, CatalogKey } from '../types/catalog.types';
import { getCatalogItems } from './catalogsApi';

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

  const promise = getCatalogItems({ catalog, is_active: true, limit: 100 }).then((res) => {
    if (res.ok) return res.data.data;
    if (entries.get(catalog)?.promise === promise) entries.delete(catalog);
    return null;
  });
  entries.set(catalog, { promise, at: Date.now() });
  return promise;
}

/** Se llama al crear, editar o borrar un item: la lista cacheada ya no vale. */
export function invalidateCatalogOptions() {
  entries.clear();
}
