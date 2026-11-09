import {
  AppNotification,
  NotificationKind,
} from '@/features/notifications/types/notification.types';
import { Attachment, Ticket, TicketType } from '@/features/tickets/types/ticket.types';
import { adminState } from './routes/adminRoutes';
import { StoredNotification, notifications as seeds } from './notificationsDb';

/**
 * Avisos dirigidos por evento. Cada aviso nace de algo que pasó en un ticket,
 * lleva sus destinatarios (roles y/o usuarios) y se guarda con la lectura POR
 * USUARIO. El filtrado por destinatario ocurre aquí, en el servidor: el cliente
 * nunca recibe avisos de otra audiencia para luego esconderlos.
 */
export const notificationState = { items: seeds.map((n) => ({ ...n, read_by: [...n.read_by] })) };

let seq = 0;

/** Quien pide la lista: lo único que el filtro necesita saber de él. */
export interface Viewer {
  id: string;
  role_id: string;
}

export interface NotifyEvent {
  kind: NotificationKind;
  title: string;
  body: string;
  ticket?: Pick<Ticket, 'id' | 'code' | 'parent_code' | 'type_is_root'>;
  roles?: (string | undefined)[];
  users?: (string | undefined)[];
}

/** Dos avisos iguales sobre el mismo ticket en esta ventana son un solo aviso. */
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

function clean(ids: (string | undefined)[] | undefined): string[] {
  return [...new Set((ids ?? []).filter((x): x is string => Boolean(x)))];
}

/** Id de rol por su código estable; el id puede cambiar si el rol se recrea. */
export function roleIdByCode(code: string): string | undefined {
  return adminState.roles.find((r) => r.code === code)?.id;
}

/** Registra un aviso. Devuelve null si no hay a quién avisar o ya existe igual. */
export function notify(event: NotifyEvent): StoredNotification | null {
  const audience_roles = clean(event.roles);
  const audience_users = clean(event.users);
  // Sin destinatarios no hay aviso: uno sin audiencia sería invisible y solo
  // ocuparía la lista.
  if (audience_roles.length === 0 && audience_users.length === 0) return null;

  const operationCode = event.ticket?.type_is_root ? event.ticket.code : event.ticket?.parent_code;
  const now = Date.now();
  const twin = notificationState.items.find(
    (n) =>
      n.kind === event.kind &&
      n.ticket_id === event.ticket?.id &&
      n.body === event.body &&
      now - new Date(n.created_at).getTime() < DEDUPE_WINDOW_MS,
  );
  if (twin) return null;

  seq += 1;
  const created: StoredNotification = {
    id: `n-${now}-${seq}`,
    kind: event.kind,
    title: event.title,
    body: event.body,
    ticket_id: event.ticket?.id,
    operation_code: operationCode,
    audience_roles,
    audience_users,
    created_at: new Date(now).toISOString(),
    read_by: [],
  };
  notificationState.items = [created, ...notificationState.items];
  return created;
}

function isForViewer(n: StoredNotification, viewer: Viewer): boolean {
  return n.audience_users.includes(viewer.id) || n.audience_roles.includes(viewer.role_id);
}

function present(n: StoredNotification, viewer: Viewer): AppNotification {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    ticket_id: n.ticket_id,
    operation_code: n.operation_code,
    audience: n.audience_roles.map((id) => adminState.roles.find((r) => r.id === id)?.name ?? id),
    created_at: n.created_at,
    read: n.read_by.includes(viewer.id),
  };
}

/** Avisos del usuario, del más nuevo al más viejo, con su conteo de no leídos. */
export function notificationsFor(viewer: Viewer): { items: AppNotification[]; unread: number } {
  const items = notificationState.items
    .filter((n) => isForViewer(n, viewer))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((n) => present(n, viewer));
  return { items, unread: items.filter((n) => !n.read).length };
}

/** Marca todo lo del usuario como leído. Devuelve cuántos cambiaron y cuántos quedan. */
export function markAllReadFor(viewer: Viewer): { marked: number; unread: number } {
  let marked = 0;
  notificationState.items
    .filter((n) => isForViewer(n, viewer) && !n.read_by.includes(viewer.id))
    .forEach((n) => {
      n.read_by = [...n.read_by, viewer.id];
      marked += 1;
    });
  return { marked, unread: 0 };
}

/**
 * Marca como leído SOLO para quien lo pide. Un aviso ajeno responde igual que
 * uno inexistente (null): un 403 confirmaría que el id existe.
 */
export function markReadFor(viewer: Viewer, id: string): AppNotification | null {
  const n = notificationState.items.find((x) => x.id === id);
  if (!n || !isForViewer(n, viewer)) return null;
  if (!n.read_by.includes(viewer.id)) n.read_by = [...n.read_by, viewer.id];
  return present(n, viewer);
}

// ---------------------------------------------------------------------------
// Eventos de ticket. Viven aquí para que ticketsRoutes solo tenga una llamada
// por punto de enganche.
// ---------------------------------------------------------------------------

const roleName = (id?: string) => adminState.roles.find((r) => r.id === id)?.name ?? 'sin rol';

/** Tripulación del vuelo: quienes vuelan y quienes lo atienden en tierra. */
function crewRoles(): (string | undefined)[] {
  return [roleIdByCode('pilot'), roleIdByCode('ground')];
}

/** Alta de un ticket: avisa al responsable y, según el tipo, a quien debe actuar. */
export function notifyTicketCreated(ticket: Ticket, parent?: Ticket) {
  const assigned = { roles: [ticket.assigned_role_id], users: [ticket.assigned_user_id] };
  const specific: NotifyEvent[] = [];

  if (ticket.type_code === 'inac_permit') {
    specific.push({
      kind: 'navaid_pending',
      title: 'Permiso INAC pendiente',
      body: `${ticket.code} (${parent?.code ?? 'sin operación'}) tiene requisitos del INAC pendientes`,
      ticket,
      roles: [roleIdByCode('operations')],
    });
  }
  if (ticket.type_code === 'technical_report') {
    specific.push({
      kind: 'technical_report',
      title: 'Reporte técnico cargado',
      body: `${ticket.code} (${parent?.code ?? 'sin operación'}) · ${ticket.title}`,
      ticket,
      roles: [roleIdByCode('maintenance')],
    });
  }
  specific.forEach(notify);

  // El aviso de asignación se omite si el específico ya llegó al mismo rol:
  // dos avisos idénticos para la misma persona son ruido.
  const coveredRoles = new Set(specific.flatMap((e) => clean(e.roles)));
  const roles = clean(assigned.roles).filter((r) => !coveredRoles.has(r));
  const users = clean(assigned.users);
  if (roles.length === 0 && users.length === 0) return;

  notify({
    kind: ticket.type_is_root ? 'operation_created' : 'ticket_assigned',
    title: ticket.type_is_root ? 'Nueva operación asignada' : 'Ticket asignado',
    body: ticket.type_is_root
      ? `${ticket.code} · ${ticket.title} · asignada a ${roleName(ticket.assigned_role_id)}`
      : `${ticket.code} (${parent?.code ?? 'sin operación'}) · ${ticket.title}`,
    ticket,
    roles,
    users,
  });
}

/** Un permiso INAC cambió a un estado no final: vuelve a ser requisito pendiente. */
export function notifyInacStatus(ticket: Ticket, type: TicketType) {
  if (ticket.type_code !== 'inac_permit' || ticket.status_is_final) return;
  const status = type.statuses.find((s) => s.code === ticket.status_code);
  notify({
    kind: 'navaid_pending',
    title: 'Permiso INAC pendiente',
    body: `${ticket.code} (${ticket.parent_code ?? 'sin operación'}) pasó a "${status?.name ?? ticket.status_name}"`,
    ticket,
    roles: [roleIdByCode('operations')],
  });
}

/** Intento de cerrar una operación frenado por requisitos INAC sin resolver. */
export function notifyCloseBlocked(operation: Ticket, blockers: Ticket[]) {
  const inac = blockers.filter((b) => b.type_code === 'inac_permit');
  if (inac.length === 0) return;
  notify({
    kind: 'close_blocked',
    title: 'Cierre bloqueado por permiso INAC',
    body: `${operation.code} no puede cerrarse: ${inac.map((b) => b.code).join(', ')} sin resolver`,
    ticket: operation,
    roles: [roleIdByCode('operations')],
  });
}

/** Comprobante leído que espera que una persona lo valide. */
export function notifyReceiptAwaiting(ticket: Ticket, file: Attachment) {
  if (!file.extraction) return;
  notify({
    kind: 'receipt_validation',
    title: 'Comprobante por validar',
    body: `${ticket.code} (${ticket.parent_code ?? 'sin operación'}) · ${file.name}`,
    ticket,
    roles: [roleIdByCode('admin')],
  });
}

/** Operación cerrada: Operaciones, Administración y la tripulación. */
export function notifyOperationClosed(ticket: Ticket, type: TicketType) {
  if (!ticket.type_is_root || !ticket.status_is_final) return;
  // Una anulación también es final, pero no es un cierre firmado.
  if (!type.statuses.find((s) => s.code === ticket.status_code)?.counts_as_committed) return;
  notify({
    kind: 'operation_closed',
    title: 'Operación cerrada y firmada',
    body: `${ticket.code} · ${ticket.title}`,
    ticket,
    roles: [roleIdByCode('operations'), roleIdByCode('admin'), ...crewRoles()],
    users: [ticket.assigned_user_id],
  });
}
