export const PERMISSIONS = {
  notificationsView: 'notifications.view',
  ticketsView: 'tickets.view',
  ticketsCreate: 'tickets.create',
  ticketsEdit: 'tickets.edit',
  ticketsDecideAny: 'tickets.decide_any',
  ticketTypesManage: 'ticket_types.manage',
  usersView: 'users.view',
  usersManage: 'users.manage',
  rolesView: 'roles.view',
  rolesManage: 'roles.manage',
  catalogsView: 'catalogs.view',
  catalogsManage: 'catalogs.manage',
  auditView: 'audit.view',
  auditExport: 'audit.export',
  analyticsView: 'analytics.view',
  // El catálogo de permisos es cerrado y vive en el servidor: validar lecturas es editar tickets
  // (`GET /attachments/pending/` exige `tickets.edit`) y las reglas se administran con los tipos.
  reviewValidate: 'tickets.edit',
  rulesManage: 'ticket_types.manage',
  reconciliationClose: 'reconciliation.close',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
