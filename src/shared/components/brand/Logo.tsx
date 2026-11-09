import { cn } from '@/shared/utils/cn';

interface LogoProps {
  className?: string;
  /** Muestra el logotipo con letras además del isotipo. */
  showText?: boolean;
  /** Fuerza la versión de letras blancas, para fondos oscuros de cualquier tema. */
  light?: boolean;
}

const ALT = 'Transvalor Orinoco, C.A.';

/**
 * Marca Transvalor. El isotipo es vectorial para que se vea nítido en
 * cualquier pantalla; las letras cambian de color según el tema.
 */
export function Logo({ className, showText = true, light = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <img
        src="/isotipo.svg"
        alt={showText ? '' : ALT}
        aria-hidden={showText ? true : undefined}
        className="h-7 w-auto shrink-0"
      />
      {showText &&
        (light ? (
          <img src="/logotipo-blanco.png" alt={ALT} className="h-5 w-auto" />
        ) : (
          <>
            <img
              src="/logotipo-negro.png"
              alt={ALT}
              className="block h-5 w-auto dark:hidden"
            />
            <img
              src="/logotipo-blanco.png"
              alt=""
              aria-hidden="true"
              className="hidden h-5 w-auto dark:block"
            />
          </>
        ))}
    </span>
  );
}
