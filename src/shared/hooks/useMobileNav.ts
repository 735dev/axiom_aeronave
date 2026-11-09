import { useMenu } from '@/shared/hooks/useMenu';

/** Ranuras de la barra inferior. La última la ocupa "Más" si sobran módulos. */
const SLOTS = 5;

/**
 * Reparte los módulos entre la barra y su panel de desbordamiento.
 *
 * `showsBar` lo consultan a la vez la barra y el layout: si cada uno decidiera
 * por su cuenta cuándo mostrarla, el espacio reservado abajo dejaría de
 * coincidir con la barra real.
 */
export function useMobileNav() {
  const { entries } = useMenu();
  const overflows = entries.length > SLOTS;

  return {
    /** Con un solo módulo no hay a dónde navegar: la barra solo ocuparía sitio. */
    showsBar: entries.length > 1,
    visible: overflows ? entries.slice(0, SLOTS - 1) : entries,
    hidden: overflows ? entries.slice(SLOTS - 1) : [],
  };
}
