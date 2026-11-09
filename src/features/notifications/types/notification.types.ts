export type NotificationKind =
  | 'operation_created'
  | 'ticket_assigned'
  | 'navaid_pending'
  | 'close_blocked'
  | 'technical_report'
  | 'receipt_validation'
  | 'operation_closed';

/** Aviso ya filtrado para quien lo pide: `read` es SU estado, no el de otros. */
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Expediente o ticket al que lleva el aviso. */
  ticket_id?: string;
  operation_code?: string;
  /** Nombres de los roles destinatarios, solo para mostrar. */
  audience: string[];
  created_at: string;
  read: boolean;
}

export interface NotificationsPage {
  unread: number;
}
