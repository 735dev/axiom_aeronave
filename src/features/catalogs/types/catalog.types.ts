export type CatalogKey =
  | 'expense_concepts'
  | 'units'
  | 'currencies'
  | 'operation_kinds'
  | 'operation_scopes'
  | 'aircraft_statuses'
  | 'aircrafts'
  | 'aircraft_brands'
  | 'aircraft_models'
  | 'airports'
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
