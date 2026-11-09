import { Ticket } from '@/features/tickets/types/ticket.types';
import { MockResponse } from './routes/adminRoutes';

/**
 * Búsqueda de pasajeros entre operaciones (§6.17: "en qué operaciones viajó
 * una persona"). Vive aparte para que la lógica de comparación se pruebe sin
 * pasar por rutas.
 */

/** Quita tildes y pasa a minúsculas: "María" y "maria" son la misma persona. */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Documento comparable: sin puntos, espacios ni guiones, en mayúsculas.
 * "V-12.345.678" y "V12345678" son el mismo documento.
 */
export function normalizeDocument(value: string): string {
  return value.replace(/[.\s\-_/]/g, '').toUpperCase();
}

export interface PassengerOperation {
  id: string;
  code: string;
  date: string;
  route: string;
  status_code: string;
  status_name: string;
  status_is_final: boolean;
}

export interface PassengerMatch {
  document: string;
  full_name: string;
  nationality?: string;
  /** Último pasaporte cargado de la persona, para abrirlo desde el resultado. */
  passport?: { ticket_id: string; file_id: string };
  operations: PassengerOperation[];
}

export const MAX_PASSENGER_RESULTS = 50;

/** Por debajo de esto casi cualquier documento coincide: el resultado no sirve. */
const MIN_DOCUMENT_QUERY = 3;

function dateOf(ticket: Ticket): string {
  const raw = ticket.payload.date;
  return String(raw ? raw : ticket.created_at).slice(0, 10);
}

function routeOf(ticket: Ticket): string {
  const from = String(ticket.payload.origin ?? '');
  const to = String(ticket.payload.destination ?? '');
  return from || to ? `${from || '?'} → ${to || '?'}` : '';
}

/**
 * Sin expresiones regulares construidas con lo que escribe el usuario:
 * `includes` sobre texto normalizado no puede explotar con `.*(` ni con
 * patrones de backtracking.
 */
export function searchPassengers(operations: Ticket[], rawQuery: string): PassengerMatch[] {
  const nameQuery = foldText(rawQuery);
  const docQuery = normalizeDocument(rawQuery);
  if (!nameQuery) return [];
  // Buscar por documento exige algún dígito: "ana" no debe traer el pasaporte "ANA123".
  const byDocument = docQuery.length >= MIN_DOCUMENT_QUERY && /\d/.test(docQuery);

  const people = new Map<string, { match: PassengerMatch; lastDate: string }>();
  const sorted = [...operations].sort((a, b) => dateOf(b).localeCompare(dateOf(a)));

  for (const op of sorted) {
    for (const pax of op.passengers ?? []) {
      const docKey = normalizeDocument(pax.document);
      if (!docKey) continue;
      const hit =
        foldText(pax.full_name).includes(nameQuery) || (byDocument && docKey.includes(docQuery));
      if (!hit) continue;

      let entry = people.get(docKey);
      if (!entry) {
        // Se recorre de la operación más reciente a la más antigua: la primera
        // que aparece fija el nombre vigente de la persona.
        entry = {
          lastDate: dateOf(op),
          match: {
            document: pax.document,
            full_name: pax.full_name,
            nationality: pax.nationality,
            operations: [],
          },
        };
        people.set(docKey, entry);
      }
      if (!entry.match.passport && pax.passport_file_id) {
        entry.match.passport = { ticket_id: op.id, file_id: pax.passport_file_id };
      }
      entry.match.operations.push({
        id: op.id,
        code: op.code,
        date: dateOf(op),
        route: routeOf(op),
        status_code: op.status_code,
        status_name: op.status_name,
        status_is_final: op.status_is_final,
      });
    }
  }

  return [...people.values()]
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
    .slice(0, MAX_PASSENGER_RESULTS)
    .map((e) => e.match);
}

/**
 * GET /passengers/search/?q=
 *
 * El alcance se aplica ANTES de buscar: solo se recorren las operaciones cuyo
 * tipo puede leer quien consulta. Quien no puede leer ninguna recibe 404, el
 * mismo que daría un recurso que no existe: un 403 confirmaría que hay datos.
 */
export function routePassengerSearch(
  method: string,
  path: string,
  query: URLSearchParams,
  tickets: Ticket[],
  rootTypeCodes: string[],
  callerPermissions: string[] | null,
): MockResponse | null {
  if (method !== 'get' || path !== '/passengers/search/') return null;
  if (callerPermissions === null) {
    return { status: 401, data: { title: 'errors.unauthorizedTitle' } };
  }
  const canRead = (typeCode: string) =>
    callerPermissions.includes('tickets.view') ||
    callerPermissions.includes(`tickets.view.${typeCode}`);

  if (!rootTypeCodes.some(canRead)) {
    return { status: 404, data: { title: 'errors.notFoundTitle' } };
  }

  const readable = tickets.filter((t) => t.type_is_root && canRead(t.type_code));
  const q = (query.get('q') ?? '').slice(0, 100);
  return { status: 200, data: { data: searchPassengers(readable, q) } };
}
