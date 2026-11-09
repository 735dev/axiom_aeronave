import { applyHomography, computeHomography } from './homography';
import { Point, Quad, RawImage, createImage } from './types';

export interface WarpOptions {
  /** Lado mayor de la salida. Por defecto, el del propio recorte. */
  maxSide?: number;
}

/** Tamaño natural del rectángulo corregido: promedio de lados opuestos. */
export function quadSize(q: Quad): { width: number; height: number } {
  const d = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  return {
    width: (d(q[0], q[1]) + d(q[3], q[2])) / 2,
    height: (d(q[0], q[3]) + d(q[1], q[2])) / 2,
  };
}

/**
 * Endereza el cuadrilátero a un rectángulo (corrección de perspectiva).
 * Muestrea al revés (destino -> origen) con interpolación bilinear, así no
 * quedan huecos. Fuera de la imagen se repite el borde.
 */
export function warpPerspective(
  src: RawImage,
  quad: Quad,
  opts: WarpOptions = {},
): RawImage | null {
  const size = quadSize(quad);
  let scale = 1;
  const longest = Math.max(size.width, size.height);
  if (opts.maxSide && longest > opts.maxSide) scale = opts.maxSide / longest;
  const width = Math.max(8, Math.round(size.width * scale));
  const height = Math.max(8, Math.round(size.height * scale));

  const h = computeHomography(
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    quad,
  );
  if (!h) return null;

  const out = createImage(width, height);
  const sw = src.width;
  const sh = src.height;
  const sd = src.data;
  const od = out.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = applyHomography(h, { x: x + 0.5, y: y + 0.5 });
      // Centro de píxel: la muestra en (px, py) continuo cae entre vecinos.
      const fx = Math.max(0, Math.min(sw - 1, p.x - 0.5));
      const fy = Math.max(0, Math.min(sh - 1, p.y - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const ax = fx - x0;
      const ay = fy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = sd[i00 + c]! * (1 - ax) + sd[i10 + c]! * ax;
        const bottom = sd[i01 + c]! * (1 - ax) + sd[i11 + c]! * ax;
        od[o + c] = top * (1 - ay) + bottom * ay;
      }
      od[o + 3] = 255;
    }
  }
  return out;
}
