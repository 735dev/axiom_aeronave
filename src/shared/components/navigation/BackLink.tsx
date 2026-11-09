import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

interface BackLinkProps {
  /** Destino cuando no hay historial propio, p. ej. al entrar por URL directa. */
  fallback: string;
  label?: string;
  className?: string;
}

/**
 * Vuelve a la pantalla anterior conservando su estado (filtros, scroll).
 * React Router marca la primera entrada del historial con key `default`:
 * ahí no hay a dónde volver y usamos el destino de respaldo.
 */
export function BackLink({ fallback, label, className }: BackLinkProps) {
  const t = useT();
  const navigate = useNavigate();
  const { key } = useLocation();

  const goBack = () => {
    if (key === 'default') navigate(fallback);
    else navigate(-1);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-apple hover:text-foreground',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label ?? t('common.back')}
    </button>
  );
}
