import { boxBlur, downscaleGray, otsu, toGray } from './image';
import { Point, Quad, RawImage } from './types';

export interface DetectResult {
  /** Esquinas en coordenadas de la imagen original. */
  corners: Quad;
  /** 0..1. Qué tan rectangular, grande y contrastado es lo encontrado. */
  confidence: number;
}

/** Lado mayor del análisis: suficiente para ubicar bordes, barato de procesar. */
const ANALYSIS_SIDE = 400;
/** Diferencia mínima de brillo entre papel y fondo para fiarse de la separación. */
const MIN_CONTRAST = 35;
const MIN_AREA = 0.12;
const MAX_AREA = 0.97;
const MIN_FILL = 0.8;
/** Más de 1 = la mancha se sale del cuadrilátero de sus esquinas (disco, óvalo): no es un papel. */
const MAX_FILL = 1.08;

function shoelace(q: Point[]): number {
  let s = 0;
  for (let i = 0; i < q.length; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % q.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Ángulo interior en `b`, en grados. */
function angleAt(a: Point, b: Point, c: Point): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** Mayor componente conexa (4-vecinos) de la máscara; devuelve el índice de sus píxeles por fila. */
function largestComponent(mask: Uint8Array, w: number, h: number) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let bestMin: Int32Array | null = null;
  let bestMax: Int32Array | null = null;
  let bestCount = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const rowMin = new Int32Array(h).fill(w);
    const rowMax = new Int32Array(h).fill(-1);
    let count = 0;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp > 0) {
      const p = stack[--sp]!;
      const x = p % w;
      const y = (p - x) / w;
      count++;
      if (x < rowMin[y]!) rowMin[y] = x;
      if (x > rowMax[y]!) rowMax[y] = x;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) ((seen[p - 1] = 1), (stack[sp++] = p - 1));
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) ((seen[p + 1] = 1), (stack[sp++] = p + 1));
      if (y > 0 && mask[p - w] && !seen[p - w]) ((seen[p - w] = 1), (stack[sp++] = p - w));
      if (y < h - 1 && mask[p + w] && !seen[p + w]) ((seen[p + w] = 1), (stack[sp++] = p + w));
    }
    if (count > bestCount) {
      bestCount = count;
      bestMin = rowMin;
      bestMax = rowMax;
    }
  }
  return bestMin && bestMax ? { rowMin: bestMin, rowMax: bestMax, count: bestCount } : null;
}

/**
 * Busca el comprobante: la mancha clara más grande sobre un fondo más oscuro.
 *
 * Umbral de Otsu sobre una versión reducida y suavizada, mayor componente
 * conexa y, de ella, las cuatro esquinas extremas. Si lo hallado no parece un
 * rectángulo fotografiado en perspectiva, devuelve null: es preferible
 * enviar la foto completa a recortar mal y perder parte del comprobante.
 */
export function detectDocument(img: RawImage): DetectResult | null {
  if (img.width < 16 || img.height < 16) return null;
  const factor = Math.max(1, Math.max(img.width, img.height) / ANALYSIS_SIDE);
  const small = boxBlur(
    downscaleGray({ width: img.width, height: img.height, data: toGray(img) }, factor),
    2,
  );
  const w = small.width;
  const h = small.height;
  const { threshold, meanLow, meanHigh } = otsu(small.data);
  const contrast = meanHigh - meanLow;
  if (contrast < MIN_CONTRAST) return null;

  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = small.data[i]! > threshold ? 1 : 0;
  const comp = largestComponent(mask, w, h);
  if (!comp) return null;

  // Un contorno convexo ocupa un solo tramo por fila: rellenar el tramo
  // ignora los huecos que deja el texto oscuro dentro del papel.
  let filled = 0;
  let tl: Point | null = null;
  let tr: Point | null = null;
  let br: Point | null = null;
  let bl: Point | null = null;
  let minS = Infinity;
  let maxS = -Infinity;
  let minD = Infinity;
  let maxD = -Infinity;
  const consider = (x: number, y: number) => {
    const s = x + y;
    const d = x - y;
    if (s < minS) ((minS = s), (tl = { x, y }));
    if (s > maxS) ((maxS = s), (br = { x, y }));
    if (d > maxD) ((maxD = d), (tr = { x, y }));
    if (d < minD) ((minD = d), (bl = { x, y }));
  };
  for (let y = 0; y < h; y++) {
    const a = comp.rowMin[y]!;
    const b = comp.rowMax[y]!;
    if (b < 0) continue;
    filled += b - a + 1;
    consider(a, y);
    consider(b, y);
  }
  if (!tl || !tr || !br || !bl) return null;

  // Esquinas de píxel (borde exterior del píxel extremo), no su centro.
  const quadSmall: Quad = [
    { x: (tl as Point).x, y: (tl as Point).y },
    { x: (tr as Point).x + 1, y: (tr as Point).y },
    { x: (br as Point).x + 1, y: (br as Point).y + 1 },
    { x: (bl as Point).x, y: (bl as Point).y + 1 },
  ];
  const quadArea = shoelace(quadSmall);
  const areaRatio = quadArea / (w * h);
  if (areaRatio < MIN_AREA || areaRatio > MAX_AREA) return null;
  const fill = filled / quadArea;
  if (fill < MIN_FILL || fill > MAX_FILL) return null;

  const angles = [
    angleAt(quadSmall[3], quadSmall[0], quadSmall[1]),
    angleAt(quadSmall[0], quadSmall[1], quadSmall[2]),
    angleAt(quadSmall[1], quadSmall[2], quadSmall[3]),
    angleAt(quadSmall[2], quadSmall[3], quadSmall[0]),
  ];
  if (angles.some((a) => a < 55 || a > 125)) return null;
  const top = dist(quadSmall[0], quadSmall[1]);
  const bottom = dist(quadSmall[3], quadSmall[2]);
  const left = dist(quadSmall[0], quadSmall[3]);
  const right = dist(quadSmall[1], quadSmall[2]);
  if (Math.max(top, bottom) / Math.max(1, Math.min(top, bottom)) > 2) return null;
  if (Math.max(left, right) / Math.max(1, Math.min(left, right)) > 2) return null;
  if (Math.min(top, bottom, left, right) < 0.1 * Math.max(w, h)) return null;

  const sx = img.width / w;
  const sy = img.height / h;
  const clamp = (p: Point): Point => ({
    x: Math.max(0, Math.min(img.width, p.x * sx)),
    y: Math.max(0, Math.min(img.height, p.y * sy)),
  });
  const corners = quadSmall.map(clamp) as Quad;

  const fillScore = Math.min(1, (fill - MIN_FILL) / 0.15);
  const contrastScore = Math.min(1, (contrast - MIN_CONTRAST) / 70);
  const angleScore = Math.max(0, 1 - Math.max(...angles.map((a) => Math.abs(a - 90))) / 35);
  const confidence = 0.4 * fillScore + 0.35 * contrastScore + 0.25 * angleScore;
  return { corners, confidence: Math.max(0, Math.min(1, confidence)) };
}
