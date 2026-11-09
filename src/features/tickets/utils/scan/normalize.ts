import { GrayImage, boxBlur, downscaleGray, maxFilter, toGray } from './image';
import { RawImage, createImage } from './types';

/** Lado mayor del estimador de fondo: la iluminación varía despacio, no hace falta más. */
const BACKGROUND_SIDE = 160;

/** Interpolación bilinear de una imagen pequeña al tamaño completo. */
function sampleBilinear(small: GrayImage, x: number, y: number, fullW: number, fullH: number) {
  const fx = Math.max(0, Math.min(small.width - 1, ((x + 0.5) / fullW) * small.width - 0.5));
  const fy = Math.max(0, Math.min(small.height - 1, ((y + 0.5) / fullH) * small.height - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(small.width - 1, x0 + 1);
  const y1 = Math.min(small.height - 1, y0 + 1);
  const ax = fx - x0;
  const ay = fy - y0;
  const d = small.data;
  const w = small.width;
  return (
    (d[y0 * w + x0]! * (1 - ax) + d[y0 * w + x1]! * ax) * (1 - ay) +
    (d[y1 * w + x0]! * (1 - ax) + d[y1 * w + x1]! * ax) * ay
  );
}

/**
 * Quita sombras y nivela la iluminación (el papel térmico fotografiado con
 * una mano encima es lo típico).
 *
 * Estima el fondo (papel sin texto) con un máximo local seguido de un
 * desenfoque grande, divide cada píxel por ese fondo y estira el contraste.
 * A diferencia de un contraste global, la sombra desaparece sin comerse el
 * trazo tenue de la impresión térmica. Devuelve gris (R=G=B).
 */
export function normalizeIllumination(img: RawImage): RawImage {
  const { width: w, height: h } = img;
  const gray = toGray(img);
  const factor = Math.max(1, Math.max(w, h) / BACKGROUND_SIDE);
  const small = downscaleGray({ width: w, height: h, data: gray }, factor);
  const background = boxBlur(maxFilter(small, 2), 4);

  const ratio = new Float32Array(w * h);
  const hist = new Uint32Array(256);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bg = Math.max(8, sampleBilinear(background, x, y, w, h));
      const r = Math.min(1.5, gray[y * w + x]! / bg);
      ratio[y * w + x] = r;
      hist[Math.min(255, Math.round(r * 170))]!++;
    }
  }
  // 1% más oscuro = tinta. Se limita para que una página sin texto no se estire.
  let acc = 0;
  let lo = 0;
  const target = w * h * 0.01;
  for (let i = 0; i < 256; i++) {
    acc += hist[i]!;
    if (acc >= target) {
      lo = i / 170;
      break;
    }
  }
  lo = Math.min(lo, 0.7);
  const hi = 0.95;

  const out = createImage(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = ((ratio[i]! - lo) / (hi - lo)) * 255;
    const o = i * 4;
    out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
  }
  return out;
}
