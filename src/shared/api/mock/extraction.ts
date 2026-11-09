import {
  Attachment,
  Confidence,
  ExtractedField,
  Extraction,
  TicketType,
} from '@/features/tickets/types/ticket.types';
import { fieldWithRole } from './money';
import { adminState } from './routes/adminRoutes';

/**
 * Simulación de la lectura automática de comprobantes.
 *
 * En producción esto es una llamada al servicio de extracción. Acá se genera
 * a partir del nombre del archivo para que la demostración sea repetible: el
 * mismo comprobante produce siempre el mismo resultado, lo que permite mostrar
 * el circuito completo sin depender de qué imagen se suba.
 */

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function catalogValue(catalog: string, index: number): { code: string; name: string } | undefined {
  const items = adminState.catalog.filter((i) => i.catalog === catalog && i.is_active);
  const item = items[index % Math.max(1, items.length)];
  return item ? { code: item.code, name: item.name } : undefined;
}

/** Fecha reciente derivada del archivo, en formato `YYYY-MM-DD`. */
function recentDate(seed: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (seed % 20));
  return d.toISOString().slice(0, 10);
}

const SUPPLIERS = ['Aeropetrol C.A.', 'Servicios Aeroportuarios Orinoco', 'Hotel Costa Azul', 'Taller Aeronáutico Maiquetía'];

export function extractFromAttachment(type: TicketType, file: Attachment): Extraction {
  return extractFrom(type, file.name, file.size);
}

/** Lectura a partir de lo mínimo que identifica al archivo: sirve antes de crear el ticket. */
export function extractFrom(type: TicketType, name: string, size: number): Extraction {
  const seed = hash(name + size);

  // Uno de cada siete comprobantes sale ilegible: es lo que hace visible que
  // el circuito tiene que funcionar igual cuando la máquina no puede leer.
  if (seed % 7 === 0) {
    return { status: 'unreadable', fields: [], corrections: [] };
  }

  const fields: ExtractedField[] = [];
  const push = (
    key: string | undefined,
    label: string,
    value: string | number,
    confidence: Confidence,
  ) => {
    if (key) fields.push({ key, label, value, confidence });
  };

  const amountField = fieldWithRole(type, 'amount');
  const currencyField = fieldWithRole(type, 'currency');
  const conceptField = fieldWithRole(type, 'item');
  const dateField = fieldWithRole(type, 'accounting_date');
  const supplierField = fieldWithRole(type, 'supplier');

  const amount = Math.round(((seed % 4000) + 120) * 100) / 100;
  push(amountField?.key, amountField?.label ?? 'Monto', amount, seed % 5 === 0 ? 'low' : 'high');

  const currency = seed % 3 === 0 ? 'VES' : 'USD';
  push(currencyField?.key, currencyField?.label ?? 'Moneda', currency, 'high');

  if (conceptField?.catalog) {
    const item = catalogValue(conceptField.catalog, seed);
    if (item) {
      push(conceptField.key, conceptField.label, item.code, seed % 4 === 0 ? 'low' : 'high');
    }
  }

  push(dateField?.key, dateField?.label ?? 'Fecha', recentDate(seed), seed % 6 === 0 ? 'low' : 'high');

  push(
    supplierField?.key,
    supplierField?.label ?? 'Proveedor',
    SUPPLIERS[seed % SUPPLIERS.length] ?? SUPPLIERS[0]!,
    seed % 8 === 0 ? 'low' : 'high',
  );

  return { status: 'extracted', fields, corrections: [] };
}

/** Un comprobante espera revisión mientras no lo confirme una persona. */
export function needsReview(file: Attachment): boolean {
  return file.extraction?.status === 'extracted';
}

/** Solo se leen imágenes, y solo en tipos que registran un importe. */
export function shouldExtract(type: TicketType, file: Attachment): boolean {
  return file.mime.startsWith('image/') && Boolean(fieldWithRole(type, 'amount'));
}
