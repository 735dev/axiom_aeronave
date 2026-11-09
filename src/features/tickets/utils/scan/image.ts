import { RawImage } from './types';

/** Luminancia (Rec. 601) por píxel. */
export function toGray(img: RawImage): Float32Array {
  const n = img.width * img.height;
  const out = new Float32Array(n);
  const d = img.data;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    out[i] = 0.299 * d[j]! + 0.587 * d[j + 1]! + 0.114 * d[j + 2]!;
  }
  return out;
}

export interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

/** Reduce por promedio de área: no deja dientes y apaga el ruido de sensor. */
export function downscaleGray(src: GrayImage, factor: number): GrayImage {
  if (factor <= 1) return src;
  const width = Math.max(1, Math.floor(src.width / factor));
  const height = Math.max(1, Math.floor(src.height / factor));
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * factor);
    const y1 = Math.min(src.height, Math.max(y0 + 1, Math.floor((y + 1) * factor)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * factor);
      const x1 = Math.min(src.width, Math.max(x0 + 1, Math.floor((x + 1) * factor)));
      let sum = 0;
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * src.width;
        for (let xx = x0; xx < x1; xx++) sum += src.data[row + xx]!;
      }
      out[y * width + x] = sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return { width, height, data: out };
}

/** Desenfoque de caja separable con sumas corridas: O(n) sin importar el radio. */
export function boxBlur(src: GrayImage, radius: number): GrayImage {
  if (radius < 1) return src;
  const { width: w, height: h } = src;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const span = 2 * radius + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += src.data[row + Math.min(w - 1, Math.max(0, k))]!;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / span;
      sum +=
        src.data[row + Math.min(w - 1, x + radius + 1)]! - src.data[row + Math.max(0, x - radius)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += tmp[Math.min(h - 1, Math.max(0, k)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / span;
      sum += tmp[Math.min(h - 1, y + radius + 1) * w + x]! - tmp[Math.max(0, y - radius) * w + x]!;
    }
  }
  return { width: w, height: h, data: out };
}

/** Máximo local en ventana cuadrada (dilatación): borra trazos oscuros finos como el texto. */
export function maxFilter(src: GrayImage, radius: number): GrayImage {
  const { width: w, height: h } = src;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, x - radius); k <= Math.min(w - 1, x + radius); k++) {
        m = Math.max(m, src.data[y * w + k]!);
      }
      tmp[y * w + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, y - radius); k <= Math.min(h - 1, y + radius); k++) {
        m = Math.max(m, tmp[k * w + x]!);
      }
      out[y * w + x] = m;
    }
  }
  return { width: w, height: h, data: out };
}

export interface OtsuResult {
  threshold: number;
  /** Media de la clase oscura y de la clara: su distancia mide cuánto se separan. */
  meanLow: number;
  meanHigh: number;
}

/** Umbral de Otsu sobre un histograma de 256 niveles. */
export function otsu(gray: Float32Array): OtsuResult {
  const hist = new Float64Array(256);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, Math.round(gray[i]!)))]!++;
  const total = gray.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t]!;
  let wB = 0;
  let sumB = 0;
  let best = -1;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  let lowSum = 0;
  let lowN = 0;
  let highSum = 0;
  let highN = 0;
  for (let t = 0; t < 256; t++) {
    if (t <= threshold) {
      lowSum += t * hist[t]!;
      lowN += hist[t]!;
    } else {
      highSum += t * hist[t]!;
      highN += hist[t]!;
    }
  }
  return {
    threshold,
    meanLow: lowN ? lowSum / lowN : 0,
    meanHigh: highN ? highSum / highN : 0,
  };
}
