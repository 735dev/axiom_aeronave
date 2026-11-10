import { TicketType } from '@/features/tickets/types/ticket.types';
import { adminState } from './adminRoutes';

const itemsOf = (catalog: string) => adminState.catalog.filter((c) => c.catalog === catalog);

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * Marca, modelo y matrícula tienen que ser coherentes entre sí (igual que el
 * backend): el modelo cuelga de la marca y la aeronave pertenece a su modelo.
 * Los campos se buscan por rol; devuelve los errores por clave de campo.
 */
export function aircraftIncoherence(
  type: TicketType,
  payload: Record<string, unknown>,
): Record<string, string> | undefined {
  const brandKey = type.fields.find((f) => f.role === 'aircraft_brand')?.key;
  const modelKey = type.fields.find((f) => f.role === 'aircraft_model')?.key;
  const aircraftKey = type.fields.find((f) => f.role === 'aircraft')?.key;
  const brand = brandKey ? text(payload[brandKey]) : '';
  const model = modelKey ? text(payload[modelKey]) : '';
  const aircraft = aircraftKey ? text(payload[aircraftKey]) : '';
  const errors: Record<string, string> = {};

  if (brandKey && brand && !itemsOf('aircraft_brands').some((b) => b.code === brand)) {
    errors[brandKey] = 'La marca no existe en el catálogo.';
  }
  const modelItem = model ? itemsOf('aircraft_models').find((m) => m.code === model) : undefined;
  if (modelKey && model) {
    if (!modelItem) errors[modelKey] = 'El modelo no existe en el catálogo.';
    else if (brand && modelItem.extra !== brand) {
      errors[modelKey] = 'El modelo no corresponde a la marca elegida.';
    }
  }
  if (aircraftKey && aircraft && model) {
    const aircraftItem = itemsOf('aircrafts').find((a) => a.code === aircraft);
    if (aircraftItem && aircraftItem.extra !== model) {
      errors[aircraftKey] = 'La matrícula no corresponde a este modelo.';
    }
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}
