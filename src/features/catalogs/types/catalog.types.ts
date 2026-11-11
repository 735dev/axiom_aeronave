export type CatalogKey =
  | 'expense_concepts'
  | 'units'
  | 'currencies'
  | 'operation_kinds'
  | 'operation_scopes'
  | 'service_types'
  | 'aircraft_statuses'
  | 'aircrafts'
  | 'aircraft_brands'
  | 'aircraft_models'
  | 'airports'
  | 'fbos'
  | 'fuel_suppliers'
  /** Personas activas de un rol (`users:pilot` = capitanes), no un catálogo editable. */
  | `users:${string}`
  | 'locations';

export interface CatalogDefinition {
  key: CatalogKey;
  name: string;
  description: string;
  items_count: number;
}

export interface CatalogItem {
  id: string;
  catalog: CatalogKey;
  code: string;
  name: string;
  extra?: string;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
}
