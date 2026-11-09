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
}: FormInputProps<T>) {
  const { control } = useFormContext<T>();
  const t = useT();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={className}>
          {label && <Label className="mb-1.5 block">{t(label)}</Label>}
          <Input
            className={inputClassName}
            {...field}
            value={field.value ?? ''}
            onChange={(e) =>
              field.onChange(type === 'number' ? e.target.valueAsNumber : e.target.value)
            }
            type={type}
            readOnly={readOnly}
            autoComplete={autoComplete}
            placeholder={placeholder ? t(placeholder) : undefined}
          />
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
