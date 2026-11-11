import { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { buildDynamicSchema, DynamicValues } from '../schemas/dynamicSchema';
import { Extraction, FieldDef } from '../types/ticket.types';
import { DynamicField } from './DynamicField';
import { resolveAircraftAutofill } from '../utils/aircraftAutofill';
import { ExchangeRate, getExchangeRate } from '../api/exchangeRateApi';
import { useCatalogOptions } from '@/features/catalogs/hooks/useCatalog';
import { Button } from '@/shared/components/ui/button';
import { useT } from '@/shared/hooks/useT';
import { notify } from '@/shared/utils/notify';
import { cn } from '@/shared/utils/cn';

interface Props {
  fields: FieldDef[];
  defaultValues?: DynamicValues;
  submitLabel?: string;
  isSubmitting?: boolean;
  onSubmit: (values: DynamicValues) => void;
  onCancel?: () => void;
  children?: React.ReactNode;
  /** Sin permiso de edición sobre el tipo: todo el formulario es de consulta. */
  readOnly?: boolean;
  /** Lo que el sistema leyó del comprobante: se propone, nunca se da por bueno. */
  proposal?: Extraction;
  /** Errores por campo que devolvió el servidor al guardar (clave del campo → mensaje). */
  serverErrors?: Record<string, string>;
}

/**
 * Los campos de tipo archivo no se dibujan en el formulario.
 *
 * Un `File` metido en el `payload` viaja como `{}` en el JSON: el usuario
 * adjuntaba una foto y el servidor recibía un objeto vacío, sin aviso. Los
 * soportes se cargan en el panel de comprobantes (y en el selector del diálogo
 * de alta), que sí los envían como archivo.
 */
const isFormField = (f: FieldDef) => f.type !== 'file';

export function DynamicForm({
  fields,
  defaultValues,
  submitLabel = 'common.save',
  isSubmitting,
  onSubmit,
  onCancel,
  children,
  readOnly,
  proposal,
  serverErrors,
}: Props) {
  const t = useT();
  const schema = useMemo(() => buildDynamicSchema(fields.filter(isFormField)), [fields]);

  const initial = useMemo(() => {
    const base: DynamicValues = {};
    fields.filter(isFormField).forEach((f) => {
      const preset = defaultValues?.[f.key];
      if (preset !== undefined) {
        base[f.key] = preset;
        return;
      }
      base[f.key] = f.type === 'checkbox' ? false : f.type === 'checkbox_group' ? [] : '';
    });
    return base;
  }, [fields, defaultValues]);

  const methods = useForm<DynamicValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  // Marca y modelo siguen a la matrícula (por rol de campo, sin claves a mano),
  // pero solo cuando la persona la cambia: un expediente abierto no se reescribe.
  const aircraftField = fields.find((f) => f.role === 'aircraft');
  const aircrafts = useCatalogOptions(aircraftField?.catalog);
  const models = useCatalogOptions(fields.find((f) => f.role === 'aircraft_model')?.catalog);
  const aircraftValue = useWatch({
    control: methods.control,
    name: aircraftField?.key ?? '',
    disabled: !aircraftField,
  });
  const lastAircraft = useRef(aircraftValue);
  const pendingAircraft = useRef(false);
  useEffect(() => {
    if (lastAircraft.current !== aircraftValue) {
      lastAircraft.current = aircraftValue;
      pendingAircraft.current = Boolean(aircraftValue);
    }
    if (!pendingAircraft.current) return;
    // Los catálogos pueden llegar después del clic: se reintenta cuando lleguen.
    if (aircrafts.length === 0 || models.length === 0) return;
    pendingAircraft.current = false;
    const proposal = resolveAircraftAutofill({ fields, aircraftValue, aircrafts, models });
    if (!proposal) return;
    Object.entries(proposal).forEach(([key, value]) =>
      methods.setValue(key, value, { shouldDirty: true, shouldValidate: false }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftValue, aircrafts, models]);

  // La tasa oficial se propone al crear. Nunca pisa lo que la persona escribió ni lo que ya
  // trae un expediente abierto, y si la fuente no responde queda el campo para escribirla.
  const rateField = fields.find((f) => f.role === 'exchange_rate');
  const [proposedRate, setProposedRate] = useState<ExchangeRate | null>(null);
  const [rateFailed, setRateFailed] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const rateEditable = Boolean(rateField) && !readOnly;
  const rateKey = rateField?.key;
  const loadRate = async (overwrite: boolean) => {
    if (!rateKey) return;
    setRateLoading(true);
    const res = await getExchangeRate();
    setRateLoading(false);
    if (!res.ok) {
      setRateFailed(true);
      return;
    }
    setRateFailed(false);
    setProposedRate(res.data);
    const current = methods.getValues(rateKey);
    const empty = current === '' || current === undefined || current === null || Number.isNaN(current);
    if (overwrite || empty) {
      methods.setValue(rateKey, res.data.rate, { shouldDirty: true, shouldValidate: false });
    }
  };
  useEffect(() => {
    const preset = rateKey ? defaultValues?.[rateKey] : undefined;
    const hasValue = preset !== undefined && preset !== null && preset !== '';
    if (rateEditable && !hasValue) void loadRate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateEditable, rateKey]);

  useEffect(() => {
    if (!serverErrors) return;
    Object.entries(serverErrors).forEach(([key, message]) => {
      if (key in methods.getValues()) methods.setError(key, { type: 'server', message });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverErrors]);

  // Confirmadas = la persona las aceptó o las corrigió. Las de baja confianza
  // no dejan guardar hasta entonces: nada leído por máquina entra sin que
  // alguien responda por ello.
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const proposed = useMemo(
    () => new Map((proposal?.fields ?? []).map((f) => [f.key, f])),
    [proposal],
  );

  useEffect(() => {
    setConfirmed(new Set());
    proposed.forEach((f) => {
      const current = methods.getValues(f.key);
      // Solo se llena lo que la persona no escribió: lo suyo manda.
      if (current === '' || current === undefined) {
        methods.setValue(f.key, f.value, { shouldDirty: true, shouldValidate: false });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposed]);

  const pendingLow = [...proposed.values()].filter(
    (f) => f.confidence === 'low' && !confirmed.has(f.key),
  );

  const submit = methods.handleSubmit((values) => {
    if (pendingLow.length > 0) {
      notify.toast.warning(t('tickets.confirmReadFields'));
      return;
    }
    onSubmit(values);
  });

  const sorted = useMemo(
    () => fields.filter(isFormField).sort((a, b) => a.sort_order - b.sort_order),
    [fields],
  );

  return (
    <FormProvider {...methods}>
      <form onSubmit={submit} className="space-y-4">
        {children}
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((field) => {
            const read = proposed.get(field.key);
            const low = read?.confidence === 'low' && !confirmed.has(field.key);
            return (
              <div
                key={field.id}
                className={cn(
                  field.width === 'half' ? 'sm:col-span-1' : 'sm:col-span-2',
                  low && 'rounded-md ring-2 ring-warning/60 ring-offset-2',
                )}
              >
                <DynamicField field={{ ...field, width: 'full' }} locked={readOnly} />
                {rateEditable && field.key === rateKey && (
                  <p
                    className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"
                    data-testid="rate-note"
                  >
                    <span>
                      {rateLoading
                        ? t('tickets.rate.loading')
                        : rateFailed
                          ? t('tickets.rate.failed')
                          : proposedRate
                            ? t('tickets.rate.proposed', {
                                date: proposedRate.effective_date ?? '—',
                              })
                            : ''}
                    </span>
                    <button
                      type="button"
                      className="font-medium text-primary underline"
                      disabled={rateLoading}
                      onClick={() => void loadRate(true)}
                    >
                      {t('tickets.rate.refresh')}
                    </button>
                  </p>
                )}
                {read && (
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span data-testid={`read-${field.key}`}>
                      {low ? t('tickets.readLow') : t('tickets.readHigh')}
                    </span>
                    {low && (
                      <button
                        type="button"
                        className="font-medium text-primary underline"
                        onClick={() => setConfirmed((c) => new Set(c).add(field.key))}
                      >
                        {t('tickets.readConfirm')}
                      </button>
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {!readOnly && (
          <div className="flex gap-3 pt-1">
            {onCancel && (
              <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {t(submitLabel)}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
