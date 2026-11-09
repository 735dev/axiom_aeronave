import { AttachmentInput } from '../api/ticketsApi';
import { scanDocument, type ScanPath, type ScanResult } from './scan/pipeline';

/** Lado máximo del comprobante enviado. Suficiente para leerlo, liviano para subir. */
const MAX_SIDE = 1600;

/** Qué hizo la preparación: base del aviso al usuario. */
export interface PrepareReport {
  /** `cropped`: se detectó y enderezó el comprobante. `full`: se conservó la foto entera. */
  path: ScanPath;
  confidence: number;
}

export interface PreparedImage extends PrepareReport {
  dataUrl: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('decode'));
      image.onload = () => resolve(image);
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Prepara la foto del comprobante antes de enviarla: detecta sus bordes, lo
 * recorta, corrige la perspectiva, quita la sombra y comprime a JPEG.
 *
 * Un ticket térmico fotografiado con sombra es ilegible tal cual sale de la
 * cámara; este paso es lo que permite que la lectura automática tenga algo
 * con qué trabajar, y de paso evita subir varios megas con señal pobre. Si no
 * se reconoce el borde con confianza, se envía la foto completa (solo
 * nivelada): jamás se recorta a ciegas.
 */
export async function prepareImageDetailed(file: File): Promise<PreparedImage> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  let result: ScanResult | null = null;
  try {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    result = scanDocument(pixels, { maxSide: MAX_SIDE });
  } catch {
    // Sin lectura de píxeles (canvas contaminado, poca memoria) el respaldo es
    // el filtro global de siempre: la foto sale igual.
    result = null;
  }

  if (!result) {
    ctx.filter = 'grayscale(1) contrast(1.35) brightness(1.08)';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), path: 'full', confidence: 0 };
  }

  const out = document.createElement('canvas');
  out.width = result.image.width;
  out.height = result.image.height;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('canvas');
  outCtx.putImageData(
    new ImageData(new Uint8ClampedArray(result.image.data), out.width, out.height),
    0,
    0,
  );
  return {
    dataUrl: out.toDataURL('image/jpeg', 0.85),
    path: result.path,
    confidence: result.confidence,
  };
}

export async function prepareImage(file: File): Promise<string> {
  return (await prepareImageDetailed(file)).dataUrl;
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/** Lo que Blackbox acepta. Se valida acá para avisar antes de gastar señal. */
export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'] as const;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Tope por registro: una cola con decenas de fotos no sale con señal pobre. */
export const MAX_FILES_PER_RECORD = 10;

/** El archivo no cumple lo que acepta el archivo documental. */
export class AttachmentRejected extends Error {
  constructor(
    readonly messageKey: string,
    readonly vars?: Record<string, string | number>,
  ) {
    super(messageKey);
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/** Bytes reales de un `data:` URL en base64. */
export function dataUrlBytes(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

/**
 * Las fotos salen de la cámara como HEIC, WEBP o con nombres sin extensión
 * útil, pero se reenvían como JPEG: el nombre debe decir lo que el archivo es.
 */
function jpegName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name || 'foto';
  return `${base}.jpg`;
}

/** Deja un archivo listo para enviar: la foto se prepara, lo demás pasa tal cual. */
export async function toAttachmentInput(
  file: File,
  /** Opcional: recibe qué camino siguió la foto (recortada o completa). */
  onPrepared?: (report: PrepareReport) => void,
): Promise<AttachmentInput> {
  const isImage = file.type.startsWith('image/');
  const name = isImage ? jpegName(file.name) : file.name;
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(name))) {
    throw new AttachmentRejected('attachments.badType');
  }
  let dataUrl: string;
  if (isImage) {
    const prepared = await prepareImageDetailed(file);
    dataUrl = prepared.dataUrl;
    onPrepared?.({ path: prepared.path, confidence: prepared.confidence });
  } else {
    dataUrl = await readAsDataUrl(file);
  }
  const bytes = dataUrlBytes(dataUrl);
  if (bytes === 0) throw new AttachmentRejected('attachments.emptyFile');
  if (bytes > MAX_FILE_BYTES) throw new AttachmentRejected('attachments.tooBig', { mb: 20 });
  return { name, mime: isImage ? 'image/jpeg' : file.type, size: file.size, data_url: dataUrl };
}
