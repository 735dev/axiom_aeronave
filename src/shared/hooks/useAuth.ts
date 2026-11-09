import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { AuthUser, logout, signedIn } from '@/shared/store/slices/authSlice';
import { persistor } from '@/shared/store';
import { signOutRemote } from '@/features/auth/api/authApi';

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, token, permissions, isAuthenticated } = useAppSelector((s) => s.auth);

  const signIn = useCallback(
    (payload: { token: string; refreshToken?: string; user: AuthUser; permissions: string[] }) => {
      dispatch(signedIn(payload));
    },
    [dispatch],
  );

  const signOut = useCallback(async () => {
    await signOutRemote();
    dispatch(logout());
    await persistor.purge();
  }, [dispatch]);

  return { user, token, permissions, isAuthenticated, roleName: user?.role_name, signIn, signOut };
}
