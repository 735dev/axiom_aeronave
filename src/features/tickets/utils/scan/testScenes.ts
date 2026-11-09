import { computeHomography } from './homography';
import { Point, Quad, RawImage, createImage } from './types';

/** Generador pseudoaleatorio con semilla: las escenas de prueba son reproducibles. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SceneOptions {
  width: number;
  height: number;
  /** Esquinas del comprobante (tl, tr, br, bl). Sin esto, la escena no tiene papel. */
  quad?: Quad;
  background?: number;
  paper?: number;
  /** Desvío estándar del ruido gaussiano de sensor. */
  noise?: number;
  /** 0..1: cuánto oscurece la sombra en el lado derecho (gradiente horizontal). */
  shadow?: number;
  seed?: number;
}

/** Cuadrilátero rectangular centrado, girado `deg` grados. */
export function rectQuad(cx: number, cy: number, w: number, h: number, deg = 0): Quad {
  const r = (deg * Math.PI) / 180;
  const pts: Point[] = [
    { x: -w / 2, y: -h / 2 },
    { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 },
    { x: -w / 2, y: h / 2 },
  ];
  return pts.map((p) => ({
    x: cx + p.x * Math.cos(r) - p.y * Math.sin(r),
    y: cy + p.x * Math.sin(r) + p.y * Math.cos(r),
  })) as Quad;
}

/** Valor del papel en coordenadas del propio comprobante (u, v en 0..1). */
export function paperPattern(u: number, v: number, paper: number): number {
  // Marcador oscuro arriba a la izquierda, dentro del margen blanco: permite saber si la orientación se conservó.
  if (u > 0.04 && u < 0.3 && v > 0.03 && v < 0.09) return 15;
  // Renglones de texto térmico (tenue, no negro).
  if (u > 0.1 && u < 0.9 && v > 0.15 && v < 0.95) {
    const row = Math.floor(v / 0.03);
    const inLine = v / 0.03 - row < 0.45;
    const col = Math.floor(u / 0.02);
    if (inLine && (col * 7 + row * 13) % 5 !== 0) return paper - 150;
  }
  return paper;
}

function gauss(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
}

/** Foto sintética: papel claro con texto, en perspectiva, sobre fondo oscuro con ruido y sombra. */
export function makeScene(o: SceneOptions): RawImage {
  const { width, height } = o;
  const img = createImage(width, height);
  const rand = rng(o.seed ?? 1);
  const bg = o.background ?? 35;
  const paper = o.paper ?? 225;
  const q = o.quad;
  const toUnit = q
    ? computeHomography(q, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ])
    : null;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let value = bg + 6 * Math.sin(x / 23) * Math.cos(y / 31);
      if (q && toUnit && inside(q, px, py)) {
        const w = toUnit[6]! * px + toUnit[7]! * py + 1;
        const u = (toUnit[0]! * px + toUnit[1]! * py + toUnit[2]!) / w;
        const v = (toUnit[3]! * px + toUnit[4]! * py + toUnit[5]!) / w;
        value = paperPattern(u, v, paper);
      }
      if (o.shadow) value *= 1 - o.shadow * (x / width);
      if (o.noise) value += o.noise * gauss(rand);
      const i = (y * width + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = value;
    }
  }
  return img;
}

function inside(q: Quad, x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i]!;
    const b = q[(i + 1) % 4]!;
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** Ruido uniforme puro: no hay documento que encontrar. */
export function makeNoise(width: number, height: number, seed = 7): RawImage {
  const img = createImage(width, height);
  const rand = rng(seed);
  for (let i = 0; i < width * height; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = rand() * 255;
  }
  return img;
}

export function lum(img: RawImage, x: number, y: number): number {
  const i = (Math.round(y) * img.width + Math.round(x)) * 4;
  return (img.data[i]! + img.data[i + 1]! + img.data[i + 2]!) / 3;
}
