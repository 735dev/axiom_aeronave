import { forwardRef } from 'react';
import { cn } from '@/shared/utils/cn';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border border-input bg-secondary px-3.5 text-sm transition-colors',
      'focus-visible:border-ring focus-visible:bg-background',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';
