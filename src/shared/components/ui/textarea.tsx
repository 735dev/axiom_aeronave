import { forwardRef } from 'react';
import { cn } from '@/shared/utils/cn';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-lg border border-input bg-secondary px-3.5 py-2.5 text-sm transition-colors',
      'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
