import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Languages, LogOut, Moon, Sun, UserCircle } from 'lucide-react';
import { useT } from '@/shared/hooks/useT';
import { useAuth } from '@/shared/hooks/useAuth';
import { useTheme } from '@/shared/hooks/useTheme';
import { useAppDispatch, useAppSelector } from '@/shared/store/hooks';
import { setLang } from '@/shared/store/slices/langSlice';
import { Avatar } from '@/shared/components/ui/avatar';

export function UserMenu() {
  const t = useT();
  const dispatch = useAppDispatch();
  const lang = useAppSelector((s) => s.lang.current);
  const { mode, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!user) return null;

  const name = user.full_name ?? user.email;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
      >
        <Avatar name={name} src={user.avatar_url} className="h-8 w-8" />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-sm font-medium leading-tight">{name}</span>
          <span className="label-strip block truncate">{user.role_name}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-md border border-border bg-card shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium">{name}</p>
            <p className="data truncate text-xs text-muted-foreground">{user.email}</p>
            <p className="label-strip mt-1.5 text-primary">{user.role_name}</p>
          </div>

          <div className="p-1">
            <Link
              to="/perfil"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-muted"
            >
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              {t('profile.title')}
            </Link>

            <button
              type="button"
              onClick={() => dispatch(setLang(lang === 'es' ? 'en' : 'es'))}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-muted"
            >
              <Languages className="h-4 w-4 text-muted-foreground" />
              {t('common.language')}
              <span className="label-strip ml-auto">{lang}</span>
            </button>

            <button
              type="button"
              onClick={toggle}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-muted"
            >
              {mode === 'dark' ? (
                <Sun className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
              {t('common.theme')}
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-destructive hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              {t('common.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
