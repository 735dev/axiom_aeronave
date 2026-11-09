/**
 * Bitácora de auditoría. Append-only: un evento nunca se edita ni se borra,
 * porque una bitácora que se puede corregir no prueba nada.
 */

export type AuditAction =
  | 'create'
  | 'update'
  | 'status_change'
  | 'decision'
  | 'comment'
  | 'attach'
  | 'delete'
  | 'login'
  | 'login_failed'
  | 'denied'
  | 'logout'
  | 'permission_change'
  | 'export';

export type AuditEntity =
  | 'ticket'
  | 'ticket_type'
  | 'user'
  | 'role'
  | 'module'
  | 'catalog'
  | 'reconciliation'
  | 'session';

/** Un campo que cambió, con su valor antes y después. */
export interface AuditChange {
  field: string;
  /** Etiqueta legible resuelta al momento del cambio. */
  label: string;
  from: unknown;
  to: unknown;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor_id: string;
  /**
   * Nombre y rol del actor CONGELADOS al momento del hecho. Si se resolvieran
   * por join, renombrar a un usuario reescribiría la historia entera.
   */
  actor_name: string;
  actor_role: string;
  action: AuditAction;
  entity: AuditEntity;
  entity_id: string;
  /** Código legible en el momento del hecho, p. ej. `TK-0003`. */
  entity_label: string;
  /** Frase ya resuelta, para poder leer la bitácora sin recomponer nada. */
  summary: string;
  changes: AuditChange[];
  /** Origen técnico del hecho. El backend lo llena, el cliente no lo envía. */
  ip?: string;
  user_agent?: string;
}

export interface AuditFilters {
  entity?: AuditEntity;
  entity_id?: string;
  action?: AuditAction;
  actor_id?: string;
  from?: string;
  to?: string;
  search?: string;
}
