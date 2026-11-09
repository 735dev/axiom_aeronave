import {
  Bell,
  ChartColumn,
  Database,
  History,
  ClipboardCheck,
  Scale,
  Gavel,
  LayoutList,
  Plane,
  PlaneTakeoff,
  UserSearch,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Pantallas que existen en la aplicación. Un módulo del catálogo solo puede
 * apuntar a una de estas rutas: crear un módulo agrega una entrada de menú,
 * no crea una pantalla.
 */
export const MODULE_ROUTES: Array<{ route: string; labelKey: string }> = [
  { route: '/tickets', labelKey: 'nav.tickets' },
  { route: '/avisos', labelKey: 'nav.notifications' },
  { route: '/bitacora-rapida', labelKey: 'nav.quicklog' },
  { route: '/pasajeros', labelKey: 'nav.passengerSearch' },
  { route: '/usuarios', labelKey: 'nav.users' },
  { route: '/roles', labelKey: 'nav.roles' },
  { route: '/permisos', labelKey: 'nav.permissions' },
  { route: '/catalogos', labelKey: 'nav.lists' },
  { route: '/analitica', labelKey: 'nav.analytics' },
  { route: '/auditoria', labelKey: 'nav.audit' },
  { route: '/validacion', labelKey: 'nav.review' },
  { route: '/conciliacion', labelKey: 'nav.reconciliation' },
  { route: '/reglas', labelKey: 'nav.rules' },
  { route: '/tipos-ticket', labelKey: 'nav.ticketTypes' },
  { route: '/estados', labelKey: 'nav.statuses' },
];

export const MODULE_ICONS: Record<string, LucideIcon> = {
  ticket: Ticket,
  bell: Bell,
  users: Users,
  shield: ShieldCheck,
  database: Database,
  list: LayoutList,
  plane: Plane,
  chart: ChartColumn,
  history: History,
  review: ClipboardCheck,
  scale: Scale,
  gavel: Gavel,
  takeoff: PlaneTakeoff,
  usersearch: UserSearch,
};

export const ICON_NAMES = Object.keys(MODULE_ICONS);

export function isKnownRoute(route: string): boolean {
  return MODULE_ROUTES.some((r) => r.route === route);
}

/**
 * Pantallas que pertenecen a un módulo aunque tengan ruta propia.
 * Sirven para que la entrada del menú siga marcada al navegar dentro.
 */
export const ROUTE_ALIASES: Record<string, string[]> = {
  '/roles': ['/modulos', '/permisos'],
};

export function matchesRoute(route: string, pathname: string): boolean {
  if (pathname === route) return true;
  if (pathname.startsWith(`${route}/`)) return true;
  return (ROUTE_ALIASES[route] ?? []).some(
    (alias) => pathname === alias || pathname.startsWith(`${alias}/`),
  );
}
