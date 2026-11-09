import { forwardRef } from 'react';
import { cn } from '@/shared/utils/cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-input bg-secondary px-3.5 text-sm transition-colors',
      'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
