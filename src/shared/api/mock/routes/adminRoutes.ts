import { AppUser } from '@/features/users/types/user.types';
import { CatalogItem, CatalogKey } from '@/features/catalogs/types/catalog.types';
import { Role } from '@/features/roles/types/role.types';
import { diffValues, recordAudit } from '../auditDb';
import {
  CATALOG_DEFINITIONS,
  appUsers,
  catalogItems,
  modules,
  permissions,
  roles,
} from '../adminDb';

export interface MockResponse {
  status: number;
  data: unknown;
}

export const adminState = {
  modules: modules.map((m) => ({ ...m })),
  permissions: permissions.map((p) => ({ ...p })),
  roles: roles.map((r) => ({ ...r })),
  users: appUsers.map((u) => ({ ...u })),
  catalog: catalogItems.map((c) => ({ ...c })),
};

function syncPermissionCounts() {
  adminState.modules.forEach((m) => {
    m.permissions_count = adminState.permissions.filter((p) => p.module_code === m.code).length;
  });
}

const TYPE_ACTIONS: Array<[string, string]> = [
  ['tickets.view', 'Ver'],
  ['tickets.create', 'Crear'],
  ['tickets.edit', 'Editar'],
];

/** Al nacer un tipo de ticket nacen sus permisos: tickets.<accion>.<tipo>. */
export function registerTypePermissions(typeCode: string, typeName: string) {
  TYPE_ACTIONS.forEach(([base, verb], i) => {
    const code = `${base}.${typeCode}`;
    if (adminState.permissions.some((p) => p.code === code)) return;
    adminState.permissions = [
      ...adminState.permissions,
      {
        id: `p-${typeCode}-${i}`,
        code,
        name: `${verb} · ${typeName}`,
        description: `Solo para el tipo ${typeName}`,
        module_code: 'tickets',
        is_system: false,
        is_active: true,
      },
    ];
  });
  syncPermissionCounts();
}

export function unregisterTypePermissions(typeCode: string) {
  const codes = TYPE_ACTIONS.map(([base]) => `${base}.${typeCode}`);
  adminState.permissions = adminState.permissions.filter((p) => !codes.includes(p.code));
  adminState.roles.forEach((r) => {
    r.permissions = r.permissions.filter((c) => !codes.includes(c));
  });
  syncPermissionCounts();
}

export function permissionsFor(roleId: string): string[] {
  return adminState.roles.find((r) => r.id === roleId)?.permissions ?? [];
}

/**
 * Permisos con los que el usuario opera de verdad:
 * los de su rol, más los concedidos aparte, menos los revocados.
 */
export function effectivePermissionsFor(userId: string): string[] {
  const user = adminState.users.find((u) => u.id === userId);
  if (!user) return [];
  const fromRole = permissionsFor(user.role_id);
  const granted = user.granted_permissions ?? [];
  const revoked = user.revoked_permissions ?? [];
  return Array.from(new Set([...fromRole, ...granted])).filter((c) => !revoked.includes(c));
}

export function paginate<T>(items: T[], query: URLSearchParams): MockResponse {
  const page = Number(query.get('page') ?? 1);
  const limit = Number(query.get('limit') ?? 10);
  const start = (page - 1) * limit;
  return {
    status: 200,
    data: {
      data: items.slice(start, start + limit),
      total: items.length,
      page,
      limit,
      links: {
        next: start + limit < items.length ? `?page=${page + 1}&limit=${limit}` : null,
        previous: page > 1 ? `?page=${page - 1}&limit=${limit}` : null,
      },
    },
  };
}

function validation(detail: string, errors?: Record<string, string>): MockResponse {
  return { status: 422, data: { title: 'errors.validationTitle', detail, errors } };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Nombre del permiso, para que la bitácora no muestre solo el código. */
function permissionLabel(code: string): string {
  const permission = adminState.permissions.find((p) => p.code === code);
  return permission ? `${permission.name} (${code})` : code;
}

function syncUserCounts() {
  adminState.roles.forEach((r) => {
    r.users_count = adminState.users.filter((u) => u.role_id === r.id).length;
  });
}

function createRole(body: Record<string, unknown>): MockResponse {
  const name = String(body.name ?? '').trim();
  if (name.length < 3) return validation('El nombre del rol es obligatorio.', { name: 'errors.required' });
  if (adminState.roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
    return validation('Ya existe un rol con ese nombre.', { name: 'roles.duplicated' });
  }
  const created: Role = {
    id: `r-${Date.now()}`,
    code: slug(name),
    name,
    description: body.description ? String(body.description) : undefined,
    is_system: false,
    is_active: true,
    permissions: Array.isArray(body.permissions) ? (body.permissions as string[]) : [],
    users_count: 0,
  };
  adminState.roles = [...adminState.roles, created];
  return { status: 201, data: created };
}

function updateRole(id: string, body: Record<string, unknown>): MockResponse {
  const role = adminState.roles.find((r) => r.id === id);
  if (!role) return { status: 404, data: { title: 'errors.notFoundTitle' } };
  const beforeRole = { name: role.name, description: role.description, is_active: role.is_active };
  const beforePermissions = [...role.permissions];
  if (body.name !== undefined) role.name = String(body.name);
  if (body.description !== undefined) role.description = String(body.description);
  if (Array.isArray(body.permissions)) role.permissions = body.permissions as string[];
  if (body.is_active !== undefined) role.is_active = body.is_active === true || body.is_active === 'true';

  const granted = role.permissions.filter((c) => !beforePermissions.includes(c));
  const removed = beforePermissions.filter((c) => !role.permissions.includes(c));
  if (granted.length > 0 || removed.length > 0) {
    recordAudit({
      action: 'permission_change',
      entity: 'role',
      entity_id: role.id,
      entity_label: role.name,
      summary:
        `Cambió los permisos del rol ${role.name}: ` +
        `+${granted.length} / -${removed.length}`,
      changes: [
        ...granted.map((code) => ({
          field: 'permission',
          label: permissionLabel(code),
          from: null,
          to: 'concedido',
        })),
        ...removed.map((code) => ({
          field: 'permission',
          label: permissionLabel(code),
          from: 'concedido',
          to: null,
        })),
      ],
    });
  }
  const roleChanges = diffValues(
    beforeRole,
    { name: role.name, description: role.description, is_active: role.is_active },
    { name: 'Nombre', description: 'Descripción', is_active: 'Activo' },
  );
  if (roleChanges.length > 0) {
    recordAudit({
      action: 'update',
      entity: 'role',
      entity_id: role.id,
      entity_label: role.name,
      summary: `Editó el rol ${role.name}`,
      changes: roleChanges,
    });
  }
  return { status: 200, data: role };
}

function deleteRole(id: string): MockResponse {
  const role = adminState.roles.find((r) => r.id === id);
  if (!role) return { status: 404, data: { title: 'errors.notFoundTitle' } };
  if (role.is_system) return validation('Ese rol es del sistema y no puede eliminarse.');
  if (adminState.users.some((u) => u.role_id === id)) {
    return validation('El rol tiene usuarios asignados. Reasígnalos antes de eliminarlo.');
  }
  adminState.roles = adminState.roles.filter((r) => r.id !== id);
  return { status: 204, data: null };
}

function createUser(body: Record<string, unknown>): MockResponse {
  const email = String(body.email ?? '').toLowerCase().trim();
  if (adminState.users.some((u) => u.email === email)) {
    return validation('Ya existe un usuario con ese correo.', { email: 'users.duplicated' });
  }
  const role = adminState.roles.find((r) => r.id === String(body.role_id ?? ''));
  if (!role) return validation('El rol seleccionado no existe.', { role_id: 'errors.required' });

  const created: AppUser = {
    id: `u-${Date.now()}`,
    full_name: String(body.full_name ?? ''),
    email,
    phone: body.phone ? String(body.phone) : undefined,
    avatar_url: body.avatar_url ? String(body.avatar_url) : undefined,
    signature_url: body.signature_url ? String(body.signature_url) : undefined,
    role_id: role.id,
    role_name: role.name,
    granted_permissions: [],
    revoked_permissions: [],
    aircraft_id: body.aircraft_id ? String(body.aircraft_id) : undefined,
    location: body.location ? String(body.location) : undefined,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  adminState.users = [...adminState.users, created];
  syncUserCounts();
  recordAudit({
    action: 'create',
    entity: 'user',
    entity_id: created.id,
    entity_label: created.email,
    summary: `Creó al usuario ${created.full_name} con el rol ${role.name}`,
    changes: [
      { field: 'full_name', label: 'Nombre', from: null, to: created.full_name },
      { field: 'email', label: 'Correo', from: null, to: created.email },
      { field: 'role', label: 'Rol', from: null, to: role.name },
    ],
  });
  return { status: 201, data: created };
}

function updateUser(id: string, body: Record<string, unknown>): MockResponse {
  const user = adminState.users.find((u) => u.id === id);
  if (!user) return { status: 404, data: { title: 'errors.notFoundTitle' } };
  const beforeUser = {
    full_name: user.full_name,
    phone: user.phone,
    location: user.location,
    is_active: user.is_active,
    role: user.role_name,
  };
  const beforeGranted = [...user.granted_permissions];
  const beforeRevoked = [...user.revoked_permissions];
  if (body.full_name !== undefined) user.full_name = String(body.full_name);
  if (body.phone !== undefined) user.phone = String(body.phone);
  if (body.avatar_url !== undefined) user.avatar_url = String(body.avatar_url) || undefined;
  if (body.signature_url !== undefined) {
    const next = String(body.signature_url) || undefined;
    // La rúbrica es lo que respalda un cierre firmado: cada alta, cambio o
    // borrado se asienta aparte, sin guardar la imagen en la bitácora.
    if (next !== user.signature_url) {
      recordAudit({
        action: 'permission_change',
        entity: 'user',
        entity_id: user.id,
        entity_label: user.email,
        summary: next
          ? `${user.signature_url ? 'Reemplazó' : 'Cargó'} la firma de ${user.full_name}`
          : `Eliminó la firma de ${user.full_name}`,
        changes: [
          {
            field: 'signature',
            label: 'Firma digital',
            from: user.signature_url ? 'registrada' : null,
            to: next ? 'registrada' : null,
          },
        ],
      });
    }
    user.signature_url = next;
  }
  if (body.location !== undefined) user.location = String(body.location);
  if (body.aircraft_id !== undefined) user.aircraft_id = String(body.aircraft_id) || undefined;
  if (body.is_active !== undefined) user.is_active = body.is_active === true || body.is_active === 'true';
  if (body.role_id !== undefined) {
    const role = adminState.roles.find((r) => r.id === String(body.role_id));
    if (!role) return validation('El rol seleccionado no existe.', { role_id: 'errors.required' });
    user.role_id = role.id;
    user.role_name = role.name;
    // Al cambiar de rol se limpian las excepciones: pertenecían al rol anterior.
    user.granted_permissions = [];
    user.revoked_permissions = [];
  }
  if (Array.isArray(body.granted_permissions)) {
    user.granted_permissions = body.granted_permissions as string[];
  }
  if (Array.isArray(body.revoked_permissions)) {
    user.revoked_permissions = body.revoked_permissions as string[];
  }
  syncUserCounts();

  const userChanges = diffValues(
    beforeUser,
    {
      full_name: user.full_name,
      phone: user.phone,
      location: user.location,
      is_active: user.is_active,
      role: user.role_name,
    },
    {
      full_name: 'Nombre',
      phone: 'Teléfono',
      location: 'Sede',
      is_active: 'Activo',
      role: 'Rol',
    },
  );
  if (userChanges.length > 0) {
    recordAudit({
      action: 'update',
      entity: 'user',
      entity_id: user.id,
      entity_label: user.email,
      summary: `Editó al usuario ${user.full_name}`,
      changes: userChanges,
    });
  }

  const exceptionChanges = [
    ...user.granted_permissions
      .filter((c) => !beforeGranted.includes(c))
      .map((code) => ({ field: 'granted', label: permissionLabel(code), from: null, to: 'concedido' })),
    ...beforeGranted
      .filter((c) => !user.granted_permissions.includes(c))
      .map((code) => ({ field: 'granted', label: permissionLabel(code), from: 'concedido', to: null })),
    ...user.revoked_permissions
      .filter((c) => !beforeRevoked.includes(c))
      .map((code) => ({ field: 'revoked', label: permissionLabel(code), from: null, to: 'revocado' })),
    ...beforeRevoked
      .filter((c) => !user.revoked_permissions.includes(c))
      .map((code) => ({ field: 'revoked', label: permissionLabel(code), from: 'revocado', to: null })),
  ];
  if (exceptionChanges.length > 0) {
    recordAudit({
      action: 'permission_change',
      entity: 'user',
      entity_id: user.id,
      entity_label: user.email,
      summary: `Cambió las excepciones de permisos de ${user.full_name}`,
      changes: exceptionChanges,
    });
  }
  return { status: 200, data: user };
}

function createCatalogItem(body: Record<string, unknown>): MockResponse {
  const catalog = String(body.catalog ?? '') as CatalogKey;
  const name = String(body.name ?? '').trim();
  if (name.length < 2) return validation('El nombre es obligatorio.', { name: 'errors.required' });
  const code = String(body.code ?? '').trim() || slug(name);
  if (adminState.catalog.some((c) => c.catalog === catalog && c.code === code)) {
    return validation('Ya existe un registro con ese código en este catálogo.', {
      code: 'catalogs.duplicated',
    });
  }
  const created: CatalogItem = {
    id: `${catalog}-${code}-${Date.now()}`,
    catalog,
    code,
    name,
    extra: body.extra ? String(body.extra) : undefined,
    is_system: false,
    is_active: true,
    sort_order: adminState.catalog.filter((c) => c.catalog === catalog).length + 1,
  };
  adminState.catalog = [...adminState.catalog, created];
  return { status: 201, data: created };
}

function updateCatalogItem(id: string, body: Record<string, unknown>): MockResponse {
  const found = adminState.catalog.find((c) => c.id === id);
  if (!found) return { status: 404, data: { title: 'errors.notFoundTitle' } };
  if (body.name !== undefined) found.name = String(body.name);
  if (body.extra !== undefined) found.extra = String(body.extra);
  if (body.is_active !== undefined) {
    const nextActive = body.is_active === true || body.is_active === 'true';
    if (!nextActive && found.is_system) {
      return validation('Ese registro es del sistema y no puede desactivarse.');
    }
    found.is_active = nextActive;
  }
  return { status: 200, data: found };
}

function deleteCatalogItem(id: string): MockResponse {
  const found = adminState.catalog.find((c) => c.id === id);
  if (!found) return { status: 404, data: { title: 'errors.notFoundTitle' } };
  if (found.is_system) return validation('Ese registro es del sistema y no puede eliminarse.');
  adminState.catalog = adminState.catalog.filter((c) => c.id !== id);
  return { status: 204, data: null };
}

function updateModule(id: string, body: Record<string, unknown>): MockResponse {
  const found = adminState.modules.find((m) => m.id === id);
  if (!found) return { status: 404, data: { title: 'errors.notFoundTitle' } };
  if (body.name !== undefined) found.name = String(body.name);
  if (body.description !== undefined) found.description = String(body.description);
  if (body.route !== undefined) found.route = String(body.route) || undefined;
  if (body.icon !== undefined) found.icon = String(body.icon) || undefined;
  if (body.menu_permission !== undefined) {
    found.menu_permission = String(body.menu_permission) || undefined;
  }
  if (body.show_in_menu !== undefined) {
    found.show_in_menu = body.show_in_menu === true || body.show_in_menu === 'true';
  }
  if (body.sort_order !== undefined) found.sort_order = Number(body.sort_order);
  if (body.is_active !== undefined) {
    found.is_active = body.is_active === true || body.is_active === 'true';
  }
  return { status: 200, data: found };
}

export function routeAdmin(
  method: string,
  path: string,
  query: URLSearchParams,
  body: Record<string, unknown>,
): MockResponse | null {
  if (method === 'get' && path === '/modules/') return { status: 200, data: adminState.modules };

  // Del módulo solo se configura su presencia en el menú.
  const moduleDetail = /^\/modules\/([^/]+)\/$/.exec(path);
  if (moduleDetail && (method === 'patch' || method === 'put')) {
    return updateModule(moduleDetail[1] ?? '', body);
  }

  if (method === 'get' && path === '/permissions/') {
    const moduleCode = query.get('module_code');
    const items = adminState.permissions.filter((p) => !moduleCode || p.module_code === moduleCode);
    return { status: 200, data: items };
  }


  if (method === 'get' && path === '/roles/') {
    const q = (query.get('q') ?? '').toLowerCase();
    const items = adminState.roles.filter((r) => !q || r.name.toLowerCase().includes(q));
    return paginate(items, query);
  }
  if (method === 'post' && path === '/roles/') return createRole(body);

  const roleDetail = /^\/roles\/([^/]+)\/$/.exec(path);
  if (roleDetail) {
    const id = roleDetail[1] ?? '';
    if (method === 'get') {
      const role = adminState.roles.find((r) => r.id === id);
      return role ? { status: 200, data: role } : { status: 404, data: { title: 'errors.notFoundTitle' } };
    }
    if (method === 'patch' || method === 'put') return updateRole(id, body);
    if (method === 'delete') return deleteRole(id);
  }

  if (method === 'get' && path === '/users/') {
    const q = (query.get('q') ?? '').toLowerCase();
    const items = adminState.users.filter(
      (u) => !q || u.full_name.toLowerCase().includes(q) || u.email.includes(q),
    );
    return paginate(items, query);
  }
  if (method === 'post' && path === '/users/') return createUser(body);

  const userDetail = /^\/users\/([^/]+)\/$/.exec(path);
  if (userDetail) {
    const id = userDetail[1] ?? '';
    if (method === 'patch' || method === 'put') return updateUser(id, body);
    if (method === 'delete') {
      adminState.users = adminState.users.filter((u) => u.id !== id);
      syncUserCounts();
      return { status: 204, data: null };
    }
  }

  if (method === 'get' && path === '/catalogs/') {
    return {
      status: 200,
      data: CATALOG_DEFINITIONS.map((d) => ({
        ...d,
        items_count: adminState.catalog.filter((c) => c.catalog === d.key).length,
      })),
    };
  }

  if (method === 'get' && path === '/catalog-items/') {
    const catalog = query.get('catalog');
    const onlyActive = query.get('is_active') === 'true';
    let items = adminState.catalog.filter((c) => !catalog || c.catalog === catalog);
    if (onlyActive) items = items.filter((c) => c.is_active);
    items = [...items].sort((a, b) => a.sort_order - b.sort_order);
    return paginate(items, query);
  }
  if (method === 'post' && path === '/catalog-items/') return createCatalogItem(body);

  const catalogDetail = /^\/catalog-items\/([^/]+)\/$/.exec(path);
  if (catalogDetail) {
    const id = catalogDetail[1] ?? '';
    if (method === 'patch' || method === 'put') return updateCatalogItem(id, body);
    if (method === 'delete') return deleteCatalogItem(id);
  }

  return null;
}
