import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getMenuModules, MenuModule } from '@/shared/auth/accessApi';
import { isKnownRoute, MODULE_ICONS } from '@/shared/config/moduleRoutes';
import { useCan } from '@/shared/hooks/useCan';

export interface MenuEntry {
  key: string;
  to: string;
  label: string;
  Icon: (typeof MODULE_ICONS)[string];
}

/**
 * El menú sale de los módulos del catálogo, no de una lista en código.
 * Se muestra un módulo si está activo, marcado para el menú, apunta a una
 * pantalla que existe y el usuario tiene su permiso.
 */
export const MENU_CHANGED_EVENT = 'menu:changed';

/** Avisa al menú que la configuración de módulos cambió. */
export function notifyMenuChanged() {
  window.dispatchEvent(new Event(MENU_CHANGED_EVENT));
}

export function useMenu() {
  const { canScoped } = useCan();
  const { pathname } = useLocation();
  const [modules, setModules] = useState<MenuModule[]>([]);

  const load = useCallback(async () => {
    const res = await getMenuModules();
    if (res.ok) setModules(res.data);
  }, []);

  // Se recarga al montar, al navegar y cuando el administrador cambia módulos.
  // El cambio de ruta es la garantía: no depende de que el evento llegue.
  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener(MENU_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MENU_CHANGED_EVENT, handler);
  }, [load]);

  const entries: MenuEntry[] = modules
    .filter((m) => m.is_active && m.show_in_menu && m.route && isKnownRoute(m.route))
    .filter((m) => !m.menu_permission || canScoped(m.menu_permission))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({
      key: m.id,
      to: m.route!,
      label: m.name,
      Icon: MODULE_ICONS[m.icon ?? ''] ?? MODULE_ICONS.ticket!,
    }));

  return { entries };
}
