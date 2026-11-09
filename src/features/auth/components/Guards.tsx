import { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/shared/store/hooks';
import { useCan } from '@/shared/hooks/useCan';

export function RequireAuth({ children }: { children?: ReactNode }) {
  const isAuth = useAppSelector((s) => s.auth.isAuthenticated);
  if (!isAuth) return <Navigate to="/login" replace />;
  return <>{children ?? <Outlet />}</>;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { canScoped } = useCan();
  if (!canScoped(permission)) return <Navigate to="/tickets" replace />;
  return <>{children}</>;
}
