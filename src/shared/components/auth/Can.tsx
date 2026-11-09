import { ReactNode } from 'react';
import { useCan } from '@/shared/hooks/useCan';

interface CanProps {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renderiza children solo si el usuario tiene el permiso indicado.
 * Envolver toda acción sensible: alta, edición, cierre y borrado.
 */
export function Can({ permission, anyOf, allOf, fallback = null, children }: CanProps) {
  const { can, canAny, canAll } = useCan();

  const allowed =
    (permission ? can(permission) : true) &&
    (anyOf ? canAny(anyOf) : true) &&
    (allOf ? canAll(allOf) : true);

  return <>{allowed ? children : fallback}</>;
}
