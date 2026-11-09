import { useCallback } from 'react';
import { useAppSelector } from '@/shared/store/hooks';

/**
 * Permisos del usuario en sesión. `can` es la única forma autorizada de
 * decidir si una acción se muestra o se habilita.
 */
export function useCan() {
  const permissions = useAppSelector((s) => s.auth.permissions) ?? [];

  const can = useCallback((code: string) => permissions.includes(code), [permissions]);

  const canAny = useCallback(
    (codes: string[]) => codes.some((c) => permissions.includes(c)),
    [permissions],
  );

  const canAll = useCallback(
    (codes: string[]) => codes.every((c) => permissions.includes(c)),
    [permissions],
  );

  /**
   * Verdadero si tiene el permiso global o cualquiera derivado de él.
   * `tickets.view` habilita todo; `tickets.view.expense` habilita ese tipo.
   */
  const canScoped = useCallback(
    (code: string) => permissions.some((p) => p === code || p.startsWith(`${code}.`)),
    [permissions],
  );

  return { can, canAny, canAll, canScoped, permissions };
}
