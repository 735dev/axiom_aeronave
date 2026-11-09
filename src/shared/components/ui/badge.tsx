import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/utils/cn';

/** Píldora de estado, en la línea de los chips del sitio de marca. */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5',
  {
    variants: {
      variant: {
        default: 'border-border bg-secondary text-muted-foreground',
        success: 'border-success/25 bg-success/10 text-success',
        warning: 'border-warning/30 bg-warning/10 text-warning',
        danger: 'border-destructive/25 bg-destructive/10 text-destructive',
        info: 'border-info/25 bg-info/10 text-info',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
