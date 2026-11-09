export interface AppUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  /** Foto del usuario, reducida a 256 px en el cliente antes de enviarse. */
  avatar_url?: string;
  /**
   * Rúbrica que se estampa al firmar un cierre. Cargarla o cambiarla es una
   * acción sensible: queda registrada en la bitácora de auditoría.
   */
  signature_url?: string;
  role_id: string;
  role_name: string;
  /** Permisos concedidos por encima del rol. */
  granted_permissions: string[];
  /** Permisos del rol que este usuario no tiene. */
  revoked_permissions: string[];
  aircraft_id?: string;
  location?: string;
  is_active: boolean;
  created_at: string;
}

export type PermissionOrigin = 'role' | 'granted' | 'revoked';

export interface EffectivePermission {
  code: string;
  name: string;
  origin: PermissionOrigin;
}
