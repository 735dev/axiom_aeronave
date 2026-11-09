import { ReactNode, useEffect } from 'react';
import { useAppSelector } from '@/shared/store/hooks';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useAppSelector((s) => s.theme.mode);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const isDark =
        mode === 'dark' ||
        (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('dark', isDark);
    };
    apply();
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [mode]);

  return <>{children}</>;
}
