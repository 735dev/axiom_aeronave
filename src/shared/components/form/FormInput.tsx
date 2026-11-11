import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { useT } from '@/shared/hooks/useT';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

interface FormInputProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  className?: string;
  /** Clases para el control, no para el contenedor. */
  inputClassName?: string;
  readOnly?: boolean;
  autoComplete?: string;
  /** Solo para `type="number"`: límite inferior y paso del control. */
  min?: number;
  step?: number | 'any';
}

export function FormInput<T extends FieldValues>({
  name,
  label,
  type = 'text',
  placeholder,
  className,
  inputClassName,
  readOnly,
  autoComplete,
  min,
  step,
}: FormInputProps<T>) {
  const { control } = useFormContext<T>();
  const t = useT();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={className}>
          {label && <Label className="mb-1.5 block">{t(label)}</Label>}
          <div className="relative">
            <Input
              className={isPassword ? `${inputClassName ?? ''} pr-10` : inputClassName}
              {...field}
              value={field.value ?? ''}
              onChange={(e) =>
                field.onChange(type === 'number' ? e.target.valueAsNumber : e.target.value)
              }
              type={isPassword && revealed ? 'text' : type}
              readOnly={readOnly}
              min={type === 'number' ? min : undefined}
              step={type === 'number' ? step : undefined}
              autoComplete={autoComplete}
              placeholder={placeholder ? t(placeholder) : undefined}
            />
            {isPassword && (
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                aria-label={t(revealed ? 'auth.login.hidePassword' : 'auth.login.showPassword')}
                aria-pressed={revealed}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
          {fieldState.error && (
            <small className="mt-1 block text-destructive">
              {t(fieldState.error.message ?? 'errors.invalid')}
            </small>
          )}
        </div>
      )}
    />
  );
}
