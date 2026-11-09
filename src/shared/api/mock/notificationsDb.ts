import { NotificationKind } from '@/features/notifications/types/notification.types';

function iso(daysAgo: number, hour = 9): string {
  const d = new Date('2026-08-19T00:00:00');
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Aviso tal como se guarda: destinatarios por id y lectura por usuario. */
export interface StoredNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  ticket_id?: string;
  operation_code?: string;
  /** Ids de rol que lo reciben. */
  audience_roles: string[];
  /** Ids de usuario que lo reciben aunque su rol no esté en la lista. */
  audience_users: string[];
  created_at: string;
  /** Usuarios que ya lo leyeron. Leer es personal: no afecta a los demás. */
  read_by: string[];
}

// Semillas: existen desde antes de la primera acción del usuario. Roles:
// r-2 operaciones, r-3 piloto, r-4 mantenimiento, r-5 tierra, r-6 administración.
export const notifications: StoredNotification[] = [
  {
    id: 'n-1',
    kind: 'operation_created',
    title: 'Nueva operación asignada',
    body: 'YV2323-004-26 · CCS → PZO · salida 08:00',
    ticket_id: 'op-4',
    operation_code: 'YV2323-004-26',
    audience_roles: ['r-3', 'r-4', 'r-5'],
    audience_users: [],
    created_at: iso(0, 7),
    read_by: [],
  },
  {
    id: 'n-2',
    kind: 'navaid_pending',
    title: 'Radioayuda pendiente de pago',
    body: 'TK-0004 sigue sin comprobante del INAC',
    ticket_id: 'op-4',
    operation_code: 'YV2323-004-26',
    audience_roles: ['r-6', 'r-2'],
    audience_users: [],
    created_at: iso(0, 9),
    read_by: [],
  },
  {
    id: 'n-3',
    kind: 'technical_report',
    title: 'Reporte técnico cargado',
    body: 'King Air 200 · indicación de combustible · requiere revisión',
    ticket_id: 'op-4',
    operation_code: 'YV2323-004-26',
    audience_roles: ['r-4', 'r-2'],
    audience_users: [],
    created_at: iso(0, 17),
    read_by: [],
  },
  {
    id: 'n-4',
    kind: 'operation_closed',
    title: 'Operación cerrada y firmada',
    body: 'YV2528-003-26 · reporte listo para administración',
    ticket_id: 'op-3',
    operation_code: 'YV2528-003-26',
    audience_roles: ['r-2', 'r-6'],
    audience_users: [],
    created_at: iso(1, 19),
    // Ya la leyeron Operaciones (u-1) y Administración (u-5).
    read_by: ['u-1', 'u-5'],
  },
];
