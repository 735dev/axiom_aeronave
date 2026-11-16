import { DynamicValues } from '../schemas/dynamicSchema';
import { FieldDef } from '../types/ticket.types';
import { formatStepValue } from '../utils/stepFields';
import { DynamicForm } from './DynamicForm';
import { useT } from '@/shared/hooks/useT';

interface Props {
  fields: FieldDef[];
  payload: DynamicValues;
  /** El paso ya tiene dueño: se muestra lo escrito, sin cajas vacías. */
  readOnly: boolean;
  showPhotoHint?: boolean;
  isSubmitting?: boolean;
  serverErrors?: Record<string, string>;
  onSubmit: (values: DynamicValues) => void;
}

export function StepFields({
  fields,
  payload,
  readOnly,
  showPhotoHint,
  isSubmitting,
  serverErrors,
  onSubmit,
}: Props) {
  const t = useT();

  if (readOnly) {
    const rows = fields.flatMap((field) => {
      const text = formatStepValue(field, payload[field.key]);
      if (!text) return [];
      return [{ key: field.key, label: field.label, text: text === 'yes' ? t('common.yes') : text }];
    });
    if (rows.length === 0) return null;
    return (
      <dl className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div key={row.key}>
            <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
            <dd className="whitespace-pre-wrap text-sm">{row.text}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">{t('tickets.stepHint')}</p>
      <DynamicForm
        fields={fields}
        defaultValues={payload}
        submitLabel="tickets.decide"
        isSubmitting={isSubmitting}
        serverErrors={serverErrors}
        onSubmit={onSubmit}
      />
      {showPhotoHint && <p className="text-xs text-muted-foreground">{t('tickets.stepPhoto')}</p>}
    </div>
  );
}
