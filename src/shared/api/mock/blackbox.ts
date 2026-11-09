/**
 * Simulación de Blackbox, el archivo documental donde viven los soportes.
 *
 * Reproduce las reglas del contrato real (`INTEGRACION_API.md` de Blackbox):
 * una carpeta `Maestro - {operación}` por expediente, extensiones y tamaño
 * acotados, idempotencia por clave y enlaces de descarga que vencen. El
 * frontend nunca habla con Blackbox: lo hace el backend de Aeronaves con una
 * credencial que no sale del servidor. Acá solo se imita ese tramo para que la
 * pantalla se comporte igual cuando exista el backend.
 */
import { TicketType } from '@/features/tickets/types/ticket.types';

export const BLACKBOX_ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'] as const;
export const BLACKBOX_MAX_BYTES = 20 * 1024 * 1024;
/** Vida del enlace de descarga, igual que el real (unos 5 minutos). */
export const BLACKBOX_LINK_TTL_MS = 5 * 60 * 1000;

export interface BlackboxDocument {
  id: string;
  folder: string;
  external_client_id: string;
  filename: string;
  document_type: string;
  mime: string;
  size: number;
  content: string;
  created_at: string;
}

export type BlackboxResult =
  | { ok: true; doc: BlackboxDocument; status: 'stored' | 'already_stored' }
  | { ok: false; status: 400 | 413; codigo: 'extension' | 'vacio' | 'tamano' | 'idempotencia'; detail: string };

export const blackboxState: {
  docs: BlackboxDocument[];
  byKey: Map<string, string>;
} = { docs: [], byKey: new Map() };

/** Tipo de documento según el tipo de ticket; espejo de `naming.py` en el backend. */
const TYPE_BY_FIELD: Record<string, string> = {
  support: 'comprobante',
  photo: 'evidencia_tecnica',
  manifest: 'manifiesto',
  approval: 'permiso_inac',
  passport: 'pasaporte',
};

export function documentTypeFor(type: TicketType, fieldKey?: string): string {
  const key = fieldKey ?? type.fields.find((f) => f.type === 'file')?.key;
  if (type.code === 'hangar_incident' && key === 'photo') return 'evidencia_hangar';
  return (key && TYPE_BY_FIELD[key]) || 'comprobante';
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase();
}

/** Bytes reales de un `data:` URL en base64. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const payload = comma < 0 ? '' : dataUrl.slice(comma + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

/**
 * Carpeta del expediente en Blackbox: `AAAA-MATRICULA-NNN`.
 *
 * Blackbox ordena las carpetas por nombre, así que el orden sale del nombre:
 * primero el año, luego la aeronave, luego el correlativo. Con el código de
 * operación tal cual (`YV2323-004-26`) el año quedaría al final y 2026 y 2027
 * se mezclarían. Lo que no cuelga de una operación va a `AAAA-SIN-OPERACION`.
 */
export function folderIdFor(operationCode: string | undefined, fallbackDate: string): string {
  const m = /^([A-Z0-9]+)-(\d{3,})-(\d{2})$/.exec(operationCode ?? '');
  if (m) return `20${m[3]}-${m[1]}-${m[2]}`;
  const year = new Date(fallbackDate).getFullYear();
  return `${Number.isNaN(year) ? new Date().getFullYear() : year}-SIN-OPERACION`;
}

/**
 * Nombre del archivo dentro de la carpeta: `TK-0002_comprobante_01_recibo.jpg`.
 * Agrupa por ticket, luego por tipo y conserva el orden de carga, así la
 * carpeta se lee sola sin abrir nada. El nombre original va al final para no
 * perder lo que la persona le puso.
 */
export function archiveFileName(input: {
  ticketCode: string;
  documentType: string;
  sequence: number;
  originalName: string;
}): string {
  const dot = input.originalName.lastIndexOf('.');
  const ext = dot < 0 ? '' : input.originalName.slice(dot).toLowerCase();
  const stem = (dot < 0 ? input.originalName : input.originalName.slice(0, dot))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const seq = String(input.sequence).padStart(2, '0');
  return `${input.ticketCode}_${input.documentType}_${seq}${stem ? `_${stem}` : ''}${ext}`;
}

export function archiveInBlackbox(input: {
  /** Id de carpeta ya resuelto con `folderIdFor`. */
  folderId: string;
  filename: string;
  mime: string;
  dataUrl: string;
  documentType: string;
  idempotencyKey?: string;
}): BlackboxResult {
  const key = input.idempotencyKey ? `aeronaves:${input.idempotencyKey}` : undefined;
  if (key && (key.length > 200 || /[\u0000-\u001f\u007f]/.test(key))) {
    return { ok: false, status: 400, codigo: 'idempotencia', detail: 'Clave de idempotencia inválida.' };
  }
  if (!(BLACKBOX_ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(input.filename))) {
    return { ok: false, status: 400, codigo: 'extension', detail: 'Extensión de archivo no permitida.' };
  }
  const size = dataUrlBytes(input.dataUrl);
  if (size === 0) return { ok: false, status: 400, codigo: 'vacio', detail: 'El archivo está vacío.' };
  if (size > BLACKBOX_MAX_BYTES) {
    return { ok: false, status: 413, codigo: 'tamano', detail: 'El archivo supera los 20 MB.' };
  }

  const existing = key ? blackboxState.byKey.get(key) : undefined;
  const hit = existing ? blackboxState.docs.find((d) => d.id === existing) : undefined;
  if (hit) return { ok: true, doc: hit, status: 'already_stored' };

  const doc: BlackboxDocument = {
    id: `bb-${blackboxState.docs.length + 1}-${Date.now()}`,
    folder: `Maestro - ${input.folderId}`,
    external_client_id: input.folderId,
    filename: input.filename,
    document_type: input.documentType,
    mime: input.mime,
    size,
    content: input.dataUrl,
    created_at: new Date().toISOString(),
  };
  blackboxState.docs = [...blackboxState.docs, doc];
  if (key) blackboxState.byKey.set(key, doc.id);
  return { ok: true, doc, status: 'stored' };
}

/** Enlace de descarga que vence. En el real es una URL firmada; acá, el contenido. */
export function signedLink(documentId: string, now = Date.now()) {
  const doc = blackboxState.docs.find((d) => d.id === documentId);
  if (!doc) return undefined;
  return { url: doc.content, expires_at: new Date(now + BLACKBOX_LINK_TTL_MS).toISOString() };
}

export function documentsOf(folderId: string): BlackboxDocument[] {
  return blackboxState.docs.filter((d) => d.external_client_id === folderId);
}
