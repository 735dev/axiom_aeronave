import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { useT } from '@/shared/hooks/useT';
import { Select } from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface FormSelectProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  options: SelectOption[];
  className?: string;
  numeric?: boolean;
  disabled?: boolean;
}

export function FormSelect<T extends FieldValues>({
  name,
  label,
  options,
  className,
  numeric,
  disabled,
}: FormSelectProps<T>) {
  const { control } = useFormContext<T>();
  const t = useT();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={className}>
          {label && <Label className="mb-1.5 block">{t(label)}</Label>}
          <Select
            {...field}
            disabled={disabled}
            value={field.value ?? ''}
            onChange={(e) => field.onChange(numeric ? Number(e.target.value) : e.target.value)}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </Select>
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
