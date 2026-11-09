import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { setTheme, toggleTheme, ThemeMode } from '@/shared/store/slices/themeSlice';

export function useTheme() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.theme.mode);
  const setMode = useCallback((m: ThemeMode) => dispatch(setTheme(m)), [dispatch]);
  const toggle = useCallback(() => dispatch(toggleTheme()), [dispatch]);
  return { mode, setMode, toggle };
}
