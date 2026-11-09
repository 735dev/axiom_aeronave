import { initials } from '@/shared/utils/initials';
import { cn } from '@/shared/utils/cn';

interface AvatarProps {
  name: string;
  src?: string;
  className?: string;
}

/** Foto del usuario, con sus iniciales como respaldo. */
export function Avatar({ name, src, className }: AvatarProps) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-mono text-xs font-medium text-primary-foreground',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
