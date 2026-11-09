import { detectDocument } from './detect';
import { normalizeIllumination } from './normalize';
import { Quad, RawImage } from './types';
import { warpPerspective } from './warp';

export type ScanPath = 'cropped' | 'full';
export type ScanFallbackReason = 'no_document' | 'low_confidence' | 'error';

export interface ScanResult {
  image: RawImage;
  /** Qué camino se usó: recorte con perspectiva corregida o foto completa. */
  path: ScanPath;
  confidence: number;
  corners: Quad | null;
  reason?: ScanFallbackReason;
}

export interface ScanOptions {
  /** Por debajo de esto no se recorta: mejor la foto entera que perder parte del comprobante. */
  minConfidence?: number;
  maxSide?: number;
}

/** Fracción de píxeles casi blancos (muestreo, no recorre todo). */
export function whiteFraction(img: RawImage): number {
  const step = Math.max(1, Math.floor((img.width * img.height) / 20000));
  let white = 0;
  let total = 0;
  for (let p = 0; p < img.width * img.height; p += step) {
    const o = p * 4;
    total++;
    if (img.data[o]! >= 245 && img.data[o + 1]! >= 245 && img.data[o + 2]! >= 245) white++;
  }
  return total === 0 ? 0 : white / total;
}

/** Fracción de píxeles oscuros (tinta) en una imagen ya normalizada a gris. */
export function inkFraction(img: RawImage): number {
  const step = Math.max(1, Math.floor((img.width * img.height) / 20000));
  let ink = 0;
  let total = 0;
  for (let p = 0; p < img.width * img.height; p += step) {
    total++;
    if (img.data[p * 4]! < 170) ink++;
  }
  return total === 0 ? 0 : ink / total;
}

/**
 * Normalizar divide por el fondo estimado: en una foto sin comprobante (un
 * degradado, un paisaje, una captura) todo queda saturado a blanco y la
 * miniatura sale vacía. Sin tinta reconocible y con una original que sí tenía
 * contenido, se conserva la original.
 */
const MIN_INK = 0.002;

function safeNormalize(img: RawImage): RawImage {
  try {
    const out = normalizeIllumination(img);
    // Una foto sin comprobante (o sin tinta que distinguir) queda saturada a blanco
    // al dividir por su propio fondo. Si la original tenía contenido, se conserva.
    if (inkFraction(out) < MIN_INK && whiteFraction(img) < 0.9) return img;
    return out;
  } catch {
    // Normalizar es una mejora; si falla se conserva la imagen tal cual.
    return img;
  }
}

/**
 * Detecta el comprobante, lo endereza y nivela la iluminación. Nunca lanza
 * ni devuelve algo vacío: ante la duda entrega la foto completa.
 */
export function scanDocument(img: RawImage, opts: ScanOptions = {}): ScanResult {
  const minConfidence = opts.minConfidence ?? 0.55;
  try {
    const found = detectDocument(img);
    if (!found) {
      return {
        image: safeNormalize(img),
        path: 'full',
        confidence: 0,
        corners: null,
        reason: 'no_document',
      };
    }
    if (found.confidence < minConfidence) {
      return {
        image: safeNormalize(img),
        path: 'full',
        confidence: found.confidence,
        corners: found.corners,
        reason: 'low_confidence',
      };
    }
    const warped = warpPerspective(img, found.corners, { maxSide: opts.maxSide });
    if (!warped) {
      return {
        image: safeNormalize(img),
        path: 'full',
        confidence: found.confidence,
        corners: found.corners,
        reason: 'error',
      };
    }
    return {
      image: safeNormalize(warped),
      path: 'cropped',
      confidence: found.confidence,
      corners: found.corners,
    };
  } catch {
    return { image: img, path: 'full', confidence: 0, corners: null, reason: 'error' };
  }
}
