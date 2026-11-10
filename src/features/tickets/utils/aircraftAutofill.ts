import { FieldDef } from '../types/ticket.types';

export interface CatalogOption {
  value: string;
  label: string;
  /** Ligadura del catálogo: la marca de un modelo, el modelo de una aeronave. */
  extra?: string;
}

/**
 * Opciones de un campo con `depends_on`: solo las que cuelgan del valor del padre.
 * Sin padre elegido se muestran todas, para no dejar el select vacío.
 */
export function filterDependentOptions<T extends CatalogOption>(
  options: T[],
  parentValue: unknown,
): T[] {
  const parent = typeof parentValue === 'string' ? parentValue : '';
  return parent ? options.filter((o) => o.extra === parent) : options;
}

export const isValidOption = (options: CatalogOption[], value: unknown) =>
  typeof value === 'string' && options.some((o) => o.value === value);

export interface AutofillInput {
  fields: FieldDef[];
  /** Matrícula que la persona acaba de elegir. */
  aircraftValue: unknown;
  aircrafts: CatalogOption[];
  models: CatalogOption[];
}

/**
 * Marca y modelo que corresponden a la matrícula elegida, resueltos por el rol
 * de cada campo (nada de claves a mano). Devuelve `null` si no hay nada que proponer.
 */
export function resolveAircraftAutofill({
  fields,
  aircraftValue,
  aircrafts,
  models,
}: AutofillInput): Record<string, string> | null {
  const modelField = fields.find((f) => f.role === 'aircraft_model');
  const brandField = fields.find((f) => f.role === 'aircraft_brand');
  if (!modelField && !brandField) return null;

  const aircraft = aircrafts.find((a) => a.value === aircraftValue);
  const modelCode = aircraft?.extra;
  if (!modelCode) return null;
  const model = models.find((m) => m.value === modelCode);
  if (!model) return null;

  const out: Record<string, string> = {};
  if (modelField) out[modelField.key] = model.value;
  if (brandField && model.extra) out[brandField.key] = model.extra;
  return Object.keys(out).length > 0 ? out : null;
}
