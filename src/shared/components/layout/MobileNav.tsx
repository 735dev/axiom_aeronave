import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import { useMobileNav } from '@/shared/hooks/useMobileNav';
import { matchesRoute } from '@/shared/config/moduleRoutes';

export function MobileNav() {
  const t = useT();
  const { showsBar, visible, hidden } = useMobileNav();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Navegar cierra el panel; si no, quedaría tapando la pantalla de destino.
  useEffect(() => setOpen(false), [pathname]);

  const hiddenIsActive = hidden.some((entry) => matchesRoute(entry.to, pathname));

  if (!showsBar) return null;

  // Altura fija: los nombres de módulo los define el administrador y uno
  // largo partía la barra en dos líneas, cambiando su alto según el ancho de
  // pantalla y descuadrando el espacio que el contenido reserva abajo.
  const itemClass = (active: boolean) =>
    cn(
      'flex h-[62px] flex-1 flex-col items-center justify-center gap-1 px-1 text-center text-[10px] leading-tight text-muted-foreground',
      active && 'text-primary',
    );

  return (
    <>
      {open && (
        <>
          <button
            type="button"
            aria-label={t('common.close')}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-[62px] z-40 border-t border-border bg-card p-2 md:hidden">
            {hidden.map(({ key, to, label, Icon }) => (
              <NavLink
                key={key}
                to={to}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                  matchesRoute(to, pathname) ? 'bg-accent text-primary' : 'text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card md:hidden">
        {visible.map(({ key, to, label, Icon }) => (
          <NavLink key={key} to={to} className={itemClass(matchesRoute(to, pathname))}>
            <Icon className="h-5 w-5 shrink-0" />
            <span className="line-clamp-2 w-full">{label}</span>
          </NavLink>
        ))}

        {hidden.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={itemClass(hiddenIsActive || open)}
          >
            <MoreHorizontal className="h-5 w-5 shrink-0" />
            <span className="line-clamp-2 w-full">{t('common.more')}</span>
          </button>
        )}
      </nav>
    </>
  );
}
