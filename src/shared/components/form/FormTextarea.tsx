import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { useT } from '@/shared/hooks/useT';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';

interface FormTextareaProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export function FormTextarea<T extends FieldValues>({
  name,
  label,
  placeholder,
  className,
  readOnly,
}: FormTextareaProps<T>) {
  const { control } = useFormContext<T>();
  const t = useT();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={className}>
          {label && <Label className="mb-1.5 block">{t(label)}</Label>}
          <Textarea
            {...field}
            value={field.value ?? ''}
            readOnly={readOnly}
            placeholder={placeholder ? t(placeholder) : undefined}
          />
          {fieldState.error && (
            <small className="mt-1 block text-red-600 dark:text-red-400">
              {t(fieldState.error.message ?? 'errors.invalid')}
            </small>
          )}
        </div>
      )}
    />
  );
}
