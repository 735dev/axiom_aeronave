import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { setPermissions, updateUser } from '@/shared/store/slices/authSlice';
import { getSession } from '@/features/auth/api/authApi';

/**
 * Revalida la sesión contra el servidor al montar la app.
 * Los permisos persistidos son solo caché: si el administrador cambió el rol,
 * esta llamada trae los permisos vigentes. Un 401 lo maneja el interceptor.
 */
export function useSessionSync() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    void getSession().then((res) => {
      if (!res.ok) return;
      dispatch(setPermissions(res.data.permissions));
      dispatch(updateUser(res.data.user));
    });
  }, [dispatch, isAuthenticated]);
}
