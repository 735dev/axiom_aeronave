import { NavLink, useLocation } from 'react-router-dom';
import { Logo } from '@/shared/components/brand/Logo';
import { cn } from '@/shared/utils/cn';
import { useMenu } from '@/shared/hooks/useMenu';
import { matchesRoute } from '@/shared/config/moduleRoutes';

export function Sidebar() {
  const { entries } = useMenu();
  const { pathname } = useLocation();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Logo />
      </div>
      <p className="label-strip px-5 pb-1 pt-4">Operaciones Aéreas</p>
      <nav className="space-y-1 p-3 pt-2">
        {entries.map(({ key, to, label, Icon }) => (
          <NavLink
            key={key}
            to={to}
            className={cn(
              'flex items-center gap-3 rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-apple hover:bg-muted hover:text-foreground',
              matchesRoute(to, pathname) &&
                'bg-accent text-primary',
            )}
          >
            <Icon
              className={cn(
                'h-4 w-4',
                matchesRoute(to, pathname) && 'text-primary',
              )}
            />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
