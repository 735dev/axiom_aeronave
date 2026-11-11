import { Module, Permission, Role } from '@/features/roles/types/role.types';
import { AppUser } from '@/features/users/types/user.types';
import { CatalogItem, CatalogKey } from '@/features/catalogs/types/catalog.types';

interface ModuleSeed {
  code: string;
  name: string;
  description: string;
  route?: string;
  icon?: string;
  menu_permission?: string;
  show_in_menu: boolean;
}

const MODULE_SEED: ModuleSeed[] = [
  {
    code: 'tickets',
    name: 'Tickets',
    description: 'Operaciones, gastos, reportes: todo el trabajo del sistema',
    route: '/tickets',
    icon: 'ticket',
    menu_permission: 'tickets.view',
    show_in_menu: true,
  },
  {
    code: 'quicklog',
    name: 'Bitácora de vuelo',
    description: 'Horarios reales, novedad y fotos del vuelo en pocos toques',
    route: '/bitacora-rapida',
    icon: 'takeoff',
    menu_permission: 'tickets.create',
    show_in_menu: true,
  },
  {
    code: 'passengers',
    name: 'Pasajeros',
    description: 'En qué operaciones viajó una persona',
    route: '/pasajeros',
    icon: 'usersearch',
    menu_permission: 'passengers.view',
    show_in_menu: true,
  },
  {
    code: 'notifications',
    name: 'Avisos',
    description: 'Notificaciones por rol',
    route: '/avisos',
    icon: 'bell',
    menu_permission: 'notifications.view',
    show_in_menu: false,
  },
  {
    code: 'users',
    name: 'Usuarios',
    description: 'Personal con acceso al sistema',
    route: '/usuarios',
    icon: 'users',
    menu_permission: 'users.view',
    show_in_menu: true,
  },
  {
    code: 'roles',
    name: 'Roles y permisos',
    description: 'Perfiles de acceso y permisología',
    route: '/roles',
    icon: 'shield',
    menu_permission: 'roles.view',
    show_in_menu: true,
  },
  {
    code: 'analytics',
    name: 'Analítica',
    description: 'Totales de gasto y actividad del sistema',
    route: '/analitica',
    icon: 'chart',
    menu_permission: 'analytics.view',
    show_in_menu: true,
  },
  {
    code: 'review',
    name: 'Validación',
    description: 'Comprobantes leídos en espera de confirmación',
    route: '/validacion',
    icon: 'review',
    menu_permission: 'tickets.edit',
    show_in_menu: true,
  },
  {
    code: 'reconciliation',
    name: 'Conciliación',
    description: 'Cruce entre gastos y comprobantes validados',
    route: '/conciliacion',
    icon: 'scale',
    menu_permission: 'analytics.view',
    show_in_menu: true,
  },
  {
    code: 'rules',
    name: 'Reglas',
    description: 'Condiciones que el sistema aplica sobre lo cargado',
    route: '/reglas',
    icon: 'gavel',
    menu_permission: 'ticket_types.manage',
    show_in_menu: true,
  },
  {
    code: 'audit',
    name: 'Auditoría',
    description: 'Bitácora de todo lo que pasa en el sistema',
    route: '/auditoria',
    icon: 'history',
    menu_permission: 'audit.view',
    show_in_menu: true,
  },
  {
    code: 'catalogs',
    name: 'Catálogos',
    description: 'Listas que alimentan los formularios',
    route: '/catalogos',
    icon: 'database',
    menu_permission: 'catalogs.view',
    show_in_menu: true,
  },
];

export const modules: Module[] = MODULE_SEED.map((seed, i) => ({
  id: `m-${i + 1}`,
  ...seed,
  sort_order: i + 1,
  is_system: true,
  is_active: true,
  permissions_count: 0,
}));

const PERMISSION_SEED: Array<[string, string, string]> = [
  ['notifications', 'notifications.view', 'Ver avisos'],
  ['tickets', 'tickets.view', 'Ver tickets'],
  ['tickets', 'tickets.create', 'Crear tickets'],
  ['tickets', 'tickets.edit', 'Editar y cambiar estado de tickets'],
  ['tickets', 'tickets.decide_any', 'Registrar decisiones de pasos de cualquier rol'],
  ['passengers', 'passengers.view', 'Consultar pasajeros de todas las operaciones'],
  ['tickets', 'ticket_types.manage', 'Definir tipos de ticket y sus formularios'],
  ['users', 'users.view', 'Ver usuarios'],
  ['users', 'users.manage', 'Crear y editar usuarios'],
  ['roles', 'roles.view', 'Ver roles'],
  ['roles', 'roles.manage', 'Crear roles y asignar permisos'],
  ['catalogs', 'catalogs.view', 'Ver catálogos'],
  ['catalogs', 'catalogs.manage', 'Administrar catálogos'],
  ['analytics', 'analytics.view', 'Ver totales de gasto y actividad'],
  ['review', 'review.validate', 'Validar comprobantes leídos automáticamente'],
  ['rules', 'rules.manage', 'Definir reglas de negocio'],
  ['reconciliation', 'reconciliation.close', 'Cerrar períodos de conciliación'],
  ['audit', 'audit.view', 'Ver la bitácora de auditoría'],
  ['audit', 'audit.export', 'Exportar la bitácora de auditoría'],
];

export const permissions: Permission[] = PERMISSION_SEED.map(([moduleCode, code, name], i) => ({
  id: `p-${i + 1}`,
  code,
  name,
  module_code: moduleCode,
  is_system: true,
  is_active: true,
}));

modules.forEach((m) => {
  m.permissions_count = permissions.filter((p) => p.module_code === m.code).length;
});

const ALL = permissions.map((p) => p.code);

export const roles: Role[] = [
  {
    id: 'r-1',
    code: 'superuser',
    name: 'Superusuario',
    description: 'Acceso total. No puede eliminarse.',
    is_system: true,
    is_active: true,
    permissions: ALL,
    users_count: 1,
  },
  {
    id: 'r-2',
    code: 'operations',
    name: 'Gerencia de Operaciones',
    description: 'Crea operaciones, consulta todo y firma el cierre.',
    is_system: false,
    is_active: true,
    permissions: [
      'tickets.view',
      'tickets.create',
      'tickets.edit',
      'tickets.decide_any',
      'ticket_types.manage',
      'notifications.view',
      'catalogs.view',
      'analytics.view',
      'passengers.view',
      'review.validate',
      'rules.manage',
    ],
    users_count: 1,
  },
  {
    id: 'r-3',
    code: 'pilot',
    name: 'Piloto',
    description: 'Carga requerimientos y reporta novedades técnicas.',
    is_system: false,
    is_active: true,
    permissions: [
      'tickets.view',
      'tickets.create',
      'tickets.edit',
      'notifications.view',
    ],
    users_count: 1,
  },
  {
    id: 'r-4',
    code: 'maintenance',
    name: 'Mantenimiento',
    description: 'Responde reportes técnicos y define el estado de la aeronave.',
    is_system: false,
    is_active: true,
    permissions: [
      'tickets.view',
      'tickets.edit',
      'notifications.view',
    ],
    users_count: 1,
  },
  {
    id: 'r-5',
    code: 'ground',
    name: 'Apoyo en tierra',
    description: 'Carga catering, traslados y consumibles.',
    is_system: false,
    is_active: true,
    permissions: [
      'tickets.view',
      'tickets.create',
      'tickets.edit',
      'notifications.view',
    ],
    users_count: 1,
  },
  {
    id: 'r-6',
    code: 'admin',
    name: 'Administración',
    description: 'Consulta el reporte cerrado de cada operación.',
    is_system: false,
    is_active: true,
    permissions: [
      'tickets.view',
      'tickets.edit',
      'notifications.view',
      'catalogs.view',
    ],
    users_count: 1,
  },
  {
    id: 'r-7',
    code: 'executive',
    name: 'Gerencia General',
    description: 'Autoriza reparaciones, movilizaciones y trabajos sobre aeronaves.',
    is_system: false,
    is_active: true,
    permissions: ['tickets.view', 'tickets.decide_any', 'notifications.view', 'analytics.view'],
    users_count: 1,
  },
  {
    id: 'r-8',
    code: 'avsec',
    name: 'Coordinación AVSEC',
    description: 'Seguridad de aviación: coordina traslados al taller y retorno al hangar, y firma el cierre.',
    is_system: false,
    is_active: true,
    permissions: ['tickets.view', 'tickets.edit', 'notifications.view'],
    users_count: 1,
  },
];

export const appUsers: AppUser[] = [
  { id: 'u-6', full_name: 'Jerson Arias', email: 'super@transvalor.com', role_id: 'r-1', role_name: 'Superusuario', granted_permissions: [], revoked_permissions: [], location: 'Caracas', is_active: true, created_at: '2026-08-01T09:00:00.000Z' },
  { id: 'u-1', full_name: 'Freya Marcano', email: 'operaciones@transvalor.com', role_id: 'r-2', role_name: 'Gerencia de Operaciones', granted_permissions: [], revoked_permissions: [], location: 'Caracas', is_active: true, created_at: '2026-08-01T09:00:00.000Z' },
  { id: 'u-2', full_name: 'Cap. Luis Rodríguez', email: 'piloto@transvalor.com', role_id: 'r-3', role_name: 'Piloto', granted_permissions: [], revoked_permissions: [], aircraft_id: 'YV2323', location: 'Charallave', is_active: true, created_at: '2026-08-02T09:00:00.000Z' },
  { id: 'u-3', full_name: 'Ramón Prieto', email: 'mantenimiento@transvalor.com', role_id: 'r-4', role_name: 'Mantenimiento', granted_permissions: [], revoked_permissions: [], location: 'Charallave', is_active: true, created_at: '2026-08-02T09:00:00.000Z' },
  { id: 'u-4', full_name: 'Deivis Salazar', email: 'tierra@transvalor.com', role_id: 'r-5', role_name: 'Apoyo en tierra', granted_permissions: [], revoked_permissions: [], location: 'Paramillo', is_active: true, created_at: '2026-08-03T09:00:00.000Z' },
  { id: 'u-5', full_name: 'Carolina Méndez', email: 'admin@transvalor.com', role_id: 'r-6', role_name: 'Administración', granted_permissions: [], revoked_permissions: [], location: 'Caracas', is_active: true, created_at: '2026-08-03T09:00:00.000Z' },
  { id: 'u-7', full_name: 'Gerencia General', email: 'gerencia@transvalor.com', role_id: 'r-7', role_name: 'Gerencia General', granted_permissions: [], revoked_permissions: [], location: 'Caracas', is_active: true, created_at: '2026-08-03T09:00:00.000Z' },
  { id: 'u-8', full_name: 'Coordinación AVSEC', email: 'avsec@transvalor.com', role_id: 'r-8', role_name: 'Coordinación AVSEC', granted_permissions: [], revoked_permissions: [], location: 'Caracas', is_active: true, created_at: '2026-08-03T09:00:00.000Z' },
];

function item(
  catalog: CatalogKey,
  code: string,
  name: string,
  order: number,
  isSystem = false,
  extra?: string,
): CatalogItem {
  return {
    id: `${catalog}-${code}`,
    catalog,
    code,
    name,
    extra,
    is_system: isSystem,
    is_active: true,
    sort_order: order,
  };
}

export const catalogItems: CatalogItem[] = [
  item('expense_concepts', 'fuel', 'Combustible', 1),
  item('expense_concepts', 'departure_tax', 'Impuesto de salida', 2),
  item('expense_concepts', 'ramp', 'Plataforma', 3),
  item('expense_concepts', 'per_diem', 'Viáticos (DOA)', 4),
  item('expense_concepts', 'navaid', 'Radioayuda (INAC)', 5, true, 'Bloquea el despacho'),
  item('expense_concepts', 'catering', 'Catering', 6),
  item('expense_concepts', 'transfer', 'Traslados', 7),
  item('expense_concepts', 'ice', 'Hielo y consumibles', 8),
  item('expense_concepts', 'other', 'Otros', 9),

  item('units', 'service', 'Servicio', 1),
  item('units', 'liters', 'Litros', 2),
  item('units', 'pounds', 'Libras', 3),
  item('units', 'gallons', 'Galones', 4),

  item('currencies', 'USD', 'Dólar', 1, true),
  item('currencies', 'VES', 'Bolívar', 2, true),

  item('operation_kinds', 'people_transfer', 'Traslado de personas', 1),
  item('operation_kinds', 'check_flight', 'Vuelo de comprobación', 2),
  item('operation_kinds', 'om_a_transfer', 'Traslado a OMAC', 3),
  item('operation_kinds', 'fuel_only', 'Solo combustible', 4),

  item('operation_scopes', 'domestic', 'Nacional', 1, true),
  item('operation_scopes', 'international', 'Internacional', 2, true),

  item('aircraft_statuses', 'operational', 'Operativa', 1, true),
  item('aircraft_statuses', 'watch', 'En observación', 2),
  item('aircraft_statuses', 'grounded', 'Fuera de servicio', 3, true),

  item('aircraft_brands', 'beechcraft', 'Beechcraft', 1),
  item('aircraft_brands', 'piper', 'Piper', 2),

  item('aircraft_models', 'king_air_200', 'King Air 200', 1, false, 'beechcraft'),
  item('aircraft_models', 'cheyenne', 'Cheyenne', 2, false, 'piper'),

  item('aircrafts', 'YV2323', 'King Air 200', 1, false, 'king_air_200'),
  item('aircrafts', 'YV2528', 'Cheyenne', 2, false, 'cheyenne'),
  item('aircrafts', 'YV2822', 'King Air 200', 3, false, 'king_air_200'),

  item('airports', 'CCS', 'Maiquetía', 1),
  item('airports', 'PZO', 'Puerto Ordaz', 2),
  item('airports', 'SVBC', 'Barcelona', 3),
  item('airports', 'SVSA', 'San Cristóbal', 4),
  item('airports', 'MDPC', 'Punta Cana', 5),

  item('locations', 'caracas', 'Caracas', 1),
  item('locations', 'charallave', 'Charallave', 2),
  item('locations', 'paramillo', 'Paramillo', 3),
];

export const CATALOG_DEFINITIONS: Array<{ key: CatalogKey; name: string; description: string }> = [
  { key: 'expense_concepts', name: 'Conceptos de gasto', description: 'Renglones que puede cargar cada rol en una operación' },
  { key: 'units', name: 'Unidades', description: 'Unidades de medida para cantidades' },
  { key: 'currencies', name: 'Monedas', description: 'Monedas admitidas al registrar un gasto' },
  { key: 'operation_kinds', name: 'Tipos de operación', description: 'Llevar y esperar, dejar e irse, u otros' },
  { key: 'operation_scopes', name: 'Alcances', description: 'Nacional o internacional' },
  { key: 'service_types', name: 'Tipos de servicio', description: 'Clase de servicio que se presta en la operación' },
  { key: 'fbos', name: 'FBO', description: 'Operadores de apoyo en tierra (FBO) con los que se trabaja' },
  { key: 'fuel_suppliers', name: 'Proveedores de combustible', description: 'Brokers y proveedores de combustible de las operaciones' },
  { key: 'aircraft_statuses', name: 'Estados de aeronave', description: 'Resultado posible de un reporte técnico' },
  { key: 'aircraft_brands', name: 'Marcas de aeronave', description: 'Fabricantes de las aeronaves de la flota' },
  { key: 'aircraft_models', name: 'Modelos de aeronave', description: 'Modelos, cada uno ligado a su marca' },
  { key: 'aircrafts', name: 'Aeronaves', description: 'Flota registrada, con matrícula y modelo' },
  { key: 'airports', name: 'Aeropuertos', description: 'Códigos y nombres usados en las rutas' },
  { key: 'locations', name: 'Sedes', description: 'Ubicaciones donde opera el personal' },
];
