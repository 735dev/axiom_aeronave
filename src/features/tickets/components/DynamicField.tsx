import { useEffect, useRef } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { FieldDef } from '../types/ticket.types';
import { filterDependentOptions, isValidOption } from '../utils/aircraftAutofill';
import { useCatalogOptions } from '@/features/catalogs/hooks/useCatalog';
import { FormInput } from '@/shared/components/form/FormInput';
import { FormTextarea } from '@/shared/components/form/FormTextarea';
import { FormSelect } from '@/shared/components/form/FormSelect';
import { FormFileInput } from '@/shared/components/form/FormFileInput';
import { Label } from '@/shared/components/ui/label';
import { useT } from '@/shared/hooks/useT';
import { useCan } from '@/shared/hooks/useCan';
import { cn } from '@/shared/utils/cn';

/**
 * Renderiza un campo cuya definición viene de la base de datos.
 * Nada aquí conoce los campos de antemano: todo sale de FieldDef.
 */
export function DynamicField({ field, locked }: { field: FieldDef; locked?: boolean }) {
  const t = useT();
  const { can } = useCan();
  const { control, getValues, setValue } = useFormContext();

  const allCatalogOptions = useCatalogOptions(field.catalog);
  // Las opciones de un campo dependiente salen del valor de su padre.
  const parentValue = useWatch({ control, name: field.depends_on ?? field.key, disabled: !field.depends_on });
  const catalogOptions = field.depends_on
    ? filterDependentOptions(allCatalogOptions, parentValue)
    : allCatalogOptions;

  // Si la persona cambia el padre y lo ya elegido deja de corresponder, se limpia.
  // Al abrir un expediente existente no se toca: solo reacciona a un cambio real.
  const lastParent = useRef(parentValue);
  useEffect(() => {
    if (!field.depends_on || lastParent.current === parentValue) return;
    lastParent.current = parentValue;
    const current = getValues(field.key);
    if (current && catalogOptions.length > 0 && !isValidOption(catalogOptions, current)) {
      setValue(field.key, '', { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentValue, catalogOptions.length]);
  const className = cn(field.width === 'half' ? 'sm:col-span-1' : 'sm:col-span-2');

  // Permisos por campo: sin el de ver, el campo no existe para este usuario;
  // sin el de editar, se muestra pero no se toca. La decisión va después de
  // los hooks para no romper su orden entre renders.
  const hidden = Boolean(field.view_permission) && !can(field.view_permission!);
  const readOnly = locked || field.read_only === true || (Boolean(field.edit_permission) && !can(field.edit_permission!));
  if (hidden) return null;

  const label = field.required ? `${field.label} *` : field.label;

  if (field.type === 'checkbox') {
    return (
      <div className={className}>
        <Controller
          control={control}
          name={field.key}
          render={({ field: rhf }) => (
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--primary))]"
                checked={Boolean(rhf.value)}
                disabled={readOnly}
                onChange={(e) => rhf.onChange(e.target.checked)}
              />
              {label}
            </label>
          )}
        />
        {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
      </div>
    );
  }

  if (field.type === 'checkbox_group') {
    return (
      <div className={className}>
        <Label className="mb-1.5 block">{label}</Label>
        <Controller
          control={control}
          name={field.key}
          render={({ field: rhf }) => {
            const selected = Array.isArray(rhf.value) ? (rhf.value as string[]) : [];
            return (
              <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                {(field.options ?? []).map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                      checked={selected.includes(option.value)}
                      disabled={readOnly}
                      onChange={(event) => rhf.onChange(
                        event.target.checked
                          ? [...selected, option.value]
                          : selected.filter((value) => value !== option.value),
                      )}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            );
          }}
        />
        {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
      </div>
    );
  }

  if (field.type === 'select') {
    const options = field.catalog ? catalogOptions : (field.options ?? []);
    return (
      <div className={className}>
        <FormSelect
          name={field.key}
          label={label}
          disabled={readOnly}
          options={[
            { value: '', label: field.required ? t('common.selectRequired') : t('common.optional') },
            ...options,
          ]}
        />
        {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className={className}>
        <FormTextarea name={field.key} label={label} readOnly={readOnly} />
        {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
      </div>
    );
  }

  if (field.type === 'file') {
    return (
      <div className={className}>
        <Label className="mb-1.5 block">{label}</Label>
        {readOnly ? (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {t('tickets.readOnlyField')}
          </p>
        ) : (
          <FormFileInput name={field.key} />
        )}
        {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
      </div>
    );
  }

  const inputType =
    field.type === 'number' || field.type === 'money'
      ? 'number'
      : field.type === 'date'
        ? 'date'
        : field.type === 'time'
          ? 'time'
          : 'text';

  return (
    <div className={className}>
      <FormInput
        name={field.key}
        label={label}
        type={inputType}
        readOnly={readOnly}
        inputClassName={
          field.type === 'money' || field.type === 'number' ? 'data' : undefined
        }
      />
      {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
    </div>
  );
}
