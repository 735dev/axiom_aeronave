import { NavLink } from 'react-router-dom';
import { KeyRound, Layers, ShieldCheck } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import { useCan } from '@/shared/hooks/useCan';
import { PERMISSIONS } from '@/shared/auth/permissions';

const SECTIONS = {
  access: [
    { to: '/roles', labelKey: 'nav.roles', icon: ShieldCheck, permission: PERMISSIONS.rolesView },
    { to: '/modulos', labelKey: 'nav.modules', icon: Layers, permission: PERMISSIONS.rolesManage },
    { to: '/permisos', labelKey: 'nav.permissions', icon: KeyRound, permission: PERMISSIONS.rolesManage },
  ],
} as const;

/** Navegación dentro de una sección de administración. */
export function AdminTabs({ section }: { section: keyof typeof SECTIONS }) {
  const t = useT();
  const { can } = useCan();
  const visible = SECTIONS[section].filter((tab) => can(tab.permission));

  if (visible.length < 2) return null;

  return (
    <nav className="-mx-4 mb-1 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
      {visible.map(({ to, labelKey, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            cn(
              'flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 pb-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
              isActive && 'border-primary text-primary',
            )
          }
        >
          <Icon className="h-3.5 w-3.5" />
          {t(labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
