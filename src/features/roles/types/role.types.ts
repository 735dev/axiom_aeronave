export interface Module {
  id: string;
  code: string;
  name: string;
  description?: string;
  /** Ruta de la pantalla a la que lleva. Vacío = no aparece en el menú. */
  route?: string;
  icon?: string;
  /** Permiso que habilita la entrada de menú. */
  menu_permission?: string;
  show_in_menu: boolean;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  permissions_count: number;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  module_code: string;
  is_system: boolean;
  is_active: boolean;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  permissions: string[];
  users_count: number;
}
