import { useCallback } from 'react';
import { useCan } from '@/shared/hooks/useCan';
import { PERMISSIONS } from './permissions';

export type TypeAction = 'view' | 'create' | 'edit';

const GLOBAL: Record<TypeAction, string> = {
  view: PERMISSIONS.ticketsView,
  create: PERMISSIONS.ticketsCreate,
  edit: PERMISSIONS.ticketsEdit,
};

/** Código del permiso derivado de un tipo: tickets.create.<tipo>. */
export function typePermissionCode(action: TypeAction, typeCode: string): string {
  return `${GLOBAL[action]}.${typeCode}`;
}

/**
 * Acceso por tipo de ticket. El permiso global habilita todos los tipos;
 * el permiso derivado habilita solo el suyo. Así un tipo creado desde la
 * aplicación queda gobernado sin tocar código.
 */
export function useTypeAccess() {
  const { can } = useCan();

  const canForType = useCallback(
    (action: TypeAction, typeCode: string) =>
      can(GLOBAL[action]) || can(typePermissionCode(action, typeCode)),
    [can],
  );

  return { canForType };
}
