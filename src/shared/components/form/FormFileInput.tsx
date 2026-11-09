import { useRef } from 'react';
import { Controller, FieldValues, Path, useFormContext } from 'react-hook-form';
import { Paperclip, Check } from 'lucide-react';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

interface FormFileInputProps<T extends FieldValues> {
  name: Path<T>;
  label?: string;
  accept?: string;
  multiple?: boolean;
  className?: string;
}

export function FormFileInput<T extends FieldValues>({
  name,
  label,
  accept = 'image/*,application/pdf',
  multiple,
  className,
}: FormFileInputProps<T>) {
  const { control } = useFormContext<T>();
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const files: File[] = Array.isArray(field.value) ? field.value : field.value ? [field.value] : [];
        const hasFiles = files.length > 0;
        return (
          <div className={className}>
            <input
              ref={ref}
              type="file"
              accept={accept}
              multiple={multiple}
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                field.onChange(multiple ? list : (list[0] ?? null));
              }}
            />
            <button
              type="button"
              onClick={() => ref.current?.click()}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm',
                hasFiles
                  ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-border text-muted-foreground hover:border-primary hover:text-primary',
              )}
            >
              {hasFiles ? <Check className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
              {hasFiles
                ? `${t('common.attached')} (${files.length})`
                : `${t('common.attach')}${label ? `: ${t(label)}` : ''}`}
            </button>
            {fieldState.error && (
              <small className="mt-1 block text-red-600 dark:text-red-400">
                {t(fieldState.error.message ?? 'errors.invalid')}
              </small>
            )}
          </div>
        );
      }}
    />
  );
}
