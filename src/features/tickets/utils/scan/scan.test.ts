import { describe, expect, it } from 'vitest';
import { applyHomography, computeHomography, solveLinear } from './homography';
import { boxBlur, downscaleGray, otsu, toGray } from './image';
import { detectDocument } from './detect';
import { warpPerspective, quadSize } from './warp';
import { normalizeIllumination } from './normalize';
import { inkFraction, scanDocument, whiteFraction } from './pipeline';
import { lum, makeNoise, makeScene, rectQuad } from './testScenes';
import { Quad, createImage } from './types';

const near = (a: number, b: number, tol: number) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

function expectCorners(found: Quad, want: Quad, tol: number) {
  found.forEach((p, i) => {
    near(p.x, want[i]!.x, tol);
    near(p.y, want[i]!.y, tol);
  });
}

describe('homografía', () => {
  it('resuelve un sistema lineal conocido', () => {
    const x = solveLinear(
      [
        [2, 1, -1],
        [-3, -1, 2],
        [-2, 1, 2],
      ],
      [8, -11, -3],
    );
    expect(x).not.toBeNull();
    [2, 3, -1].forEach((v, i) => near(x![i]!, v, 1e-9));
  });

  it('declara singular una matriz con filas dependientes', () => {
    expect(
      solveLinear(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toBeNull();
  });

  it('la identidad deja los puntos donde están', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const h = computeHomography(sq, sq)!;
    const p = applyHomography(h, { x: 3.3, y: 7.1 });
    near(p.x, 3.3, 1e-9);
    near(p.y, 7.1, 1e-9);
  });

  it('reproduce exactamente una traslación con escala', () => {
    const from = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const to = from.map((p) => ({ x: 3 * p.x + 5, y: 2 * p.y - 4 }));
    const h = computeHomography(from, to)!;
    const p = applyHomography(h, { x: 0.25, y: 0.75 });
    near(p.x, 5.75, 1e-9);
    near(p.y, -2.5, 1e-9);
  });

  it('recupera una proyectiva conocida en puntos que no usó para resolverla', () => {
    const h0 = [1.2, 0.1, 30, -0.05, 0.9, 12, 0.0008, 0.0004, 1];
    const from = [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 600 },
      { x: 0, y: 600 },
    ];
    const to = from.map((p) => applyHomography(h0, p));
    const h = computeHomography(from, to)!;
    for (const p of [
      { x: 100, y: 200 },
      { x: 399, y: 1 },
      { x: 211.5, y: 480.25 },
    ]) {
      const a = applyHomography(h0, p);
      const b = applyHomography(h, p);
      near(a.x, b.x, 1e-6);
      near(a.y, b.y, 1e-6);
    }
  });

  it('ida y vuelta devuelve el punto original', () => {
    const a = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 500 },
      { x: 0, y: 500 },
    ];
    const b = [
      { x: 40, y: 20 },
      { x: 280, y: 60 },
      { x: 330, y: 480 },
      { x: 10, y: 430 },
    ];
    const ab = computeHomography(a, b)!;
    const ba = computeHomography(b, a)!;
    const p = applyHomography(ba, applyHomography(ab, { x: 123, y: 321 }));
    near(p.x, 123, 1e-6);
    near(p.y, 321, 1e-6);
  });

  it('devuelve null con puntos colineales', () => {
    const line = [0, 1, 2, 3].map((i) => ({ x: i, y: i }));
    expect(computeHomography(line, line)).toBeNull();
  });

  it('exige exactamente cuatro pares', () => {
    expect(computeHomography([{ x: 0, y: 0 }], [{ x: 0, y: 0 }])).toBeNull();
  });
});

describe('utilidades de imagen', () => {
  it('reducir conserva el brillo medio y las dimensiones esperadas', () => {
    const g = { width: 100, height: 60, data: new Float32Array(6000).fill(80) };
    const s = downscaleGray(g, 4);
    expect([s.width, s.height]).toEqual([25, 15]);
    near(s.data[10]!, 80, 1e-4);
  });

  it('desenfocar una imagen uniforme no la altera', () => {
    const g = { width: 30, height: 20, data: new Float32Array(600).fill(50) };
    boxBlur(g, 3).data.forEach((v) => near(v, 50, 1e-4));
  });

  it('Otsu separa dos poblaciones', () => {
    const data = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) data[i] = i < 400 ? 30 : 200;
    const r = otsu(data);
    expect(r.threshold).toBeGreaterThanOrEqual(30);
    expect(r.threshold).toBeLessThan(200);
    near(r.meanLow, 30, 1);
    near(r.meanHigh, 200, 1);
  });

  it('toGray pondera verde más que azul', () => {
    const img = createImage(2, 1);
    img.data.set([0, 255, 0, 255, 0, 0, 255, 255]);
    const g = toGray(img);
    expect(g[0]!).toBeGreaterThan(g[1]!);
  });
});

describe('detección de bordes', () => {
  const W = 800;
  const H = 600;
  const tol = 0.015 * Math.hypot(W, H);

  it('encuentra un comprobante alineado', () => {
    const quad = rectQuad(400, 300, 300, 480);
    const found = detectDocument(makeScene({ width: W, height: H, quad }))!;
    expect(found).not.toBeNull();
    expectCorners(found.corners, quad, tol);
  });

  it('encuentra un comprobante en perspectiva', () => {
    const quad: Quad = [
      { x: 220, y: 70 },
      { x: 560, y: 110 },
      { x: 610, y: 530 },
      { x: 180, y: 490 },
    ];
    const found = detectDocument(makeScene({ width: W, height: H, quad, noise: 10 }))!;
    expect(found).not.toBeNull();
    expectCorners(found.corners, quad, tol);
  });

  it('encuentra un comprobante girado 20 grados', () => {
    const quad = rectQuad(400, 300, 260, 420, 20);
    const found = detectDocument(makeScene({ width: W, height: H, quad }))!;
    expect(found).not.toBeNull();
    expectCorners(found.corners, quad, tol);
  });

  it('tolera una sombra que atraviesa la escena', () => {
    const quad = rectQuad(380, 300, 320, 480, -8);
    const found = detectDocument(makeScene({ width: W, height: H, quad, shadow: 0.45, noise: 8 }))!;
    expect(found).not.toBeNull();
    expectCorners(found.corners, quad, tol);
  });

  it('devuelve las esquinas en orden arriba-izq, arriba-der, abajo-der, abajo-izq', () => {
    const c = detectDocument(
      makeScene({ width: W, height: H, quad: rectQuad(400, 300, 300, 450) }),
    )!.corners;
    expect(c[0].x).toBeLessThan(c[1].x);
    expect(c[0].y).toBeLessThan(c[3].y);
    expect(c[2].x).toBeGreaterThan(c[3].x);
    expect(c[2].y).toBeGreaterThan(c[1].y);
  });

  it('da más confianza a una escena limpia que a una de contraste justo', () => {
    const quad = rectQuad(400, 300, 300, 450);
    const clean = detectDocument(makeScene({ width: W, height: H, quad }))!;
    const weak = detectDocument(
      makeScene({ width: W, height: H, quad, background: 120, paper: 175 }),
    );
    expect(clean.confidence).toBeGreaterThan(0.7);
    expect(weak === null || weak.confidence < clean.confidence).toBe(true);
  });

  it('no inventa un comprobante en una imagen uniforme', () => {
    expect(detectDocument(createImage(W, H, 128))).toBeNull();
  });

  it('no inventa un comprobante en ruido puro', () => {
    expect(detectDocument(makeNoise(W, H))).toBeNull();
  });

  it('descarta un papel que ocupa todo el cuadro (no hay nada que recortar)', () => {
    const quad = rectQuad(400, 300, 800, 600);
    expect(detectDocument(makeScene({ width: W, height: H, quad }))).toBeNull();
  });

  it('descarta una mancha clara diminuta', () => {
    const quad = rectQuad(400, 300, 40, 50);
    expect(detectDocument(makeScene({ width: W, height: H, quad }))).toBeNull();
  });

  it('descarta un contraste insuficiente entre papel y fondo', () => {
    const quad = rectQuad(400, 300, 300, 450);
    expect(
      detectDocument(makeScene({ width: W, height: H, quad, background: 110, paper: 130 })),
    ).toBeNull();
  });

  it('descarta un disco claro: se sale del cuadrilátero de sus esquinas', () => {
    const img = createImage(W, H, 35);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (Math.hypot(x - 400, y - 300) < 220) img.data[(y * W + x) * 4] = 230;
      }
    }
    for (let i = 0; i < W * H; i++) img.data[i * 4 + 1] = img.data[i * 4 + 2] = img.data[i * 4]!;
    expect(detectDocument(img)).toBeNull();
  });

  it('descarta un triángulo (esquina colapsada)', () => {
    const quad: Quad = [
      { x: 400, y: 80 },
      { x: 401, y: 80 },
      { x: 650, y: 520 },
      { x: 150, y: 520 },
    ];
    expect(detectDocument(makeScene({ width: W, height: H, quad }))).toBeNull();
  });
});

describe('corrección de perspectiva', () => {
  const W = 800;
  const H = 600;
  const quad: Quad = [
    { x: 230, y: 60 },
    { x: 570, y: 90 },
    { x: 600, y: 540 },
    { x: 200, y: 510 },
  ];
  const scene = makeScene({ width: W, height: H, quad });

  it('la salida tiene la proporción del comprobante real', () => {
    const out = warpPerspective(scene, quad)!;
    const s = quadSize(quad);
    near(out.width / out.height, s.width / s.height, 0.03);
  });

  it('conserva la orientación: el marcador queda arriba a la izquierda', () => {
    const out = warpPerspective(scene, quad)!;
    expect(lum(out, out.width * 0.15, out.height * 0.06)).toBeLessThan(60);
    expect(lum(out, out.width * 0.9, out.height * 0.06)).toBeGreaterThan(180);
    expect(lum(out, out.width * 0.15, out.height * 0.97)).toBeGreaterThan(180);
  });

  it('el papel llena todo el recorte, sin fondo oscuro en los bordes', () => {
    const out = warpPerspective(scene, quad)!;
    for (const [fx, fy] of [
      [0.95, 0.02],
      [0.03, 0.98],
      [0.97, 0.98],
    ] as const) {
      expect(lum(out, out.width * fx, out.height * fy)).toBeGreaterThan(150);
    }
  });

  it('un recorte alineado copia los píxeles de origen', () => {
    const img = makeScene({ width: 200, height: 100, quad: rectQuad(100, 50, 120, 80) });
    const q: Quad = [
      { x: 40, y: 10 },
      { x: 160, y: 10 },
      { x: 160, y: 90 },
      { x: 40, y: 90 },
    ];
    const out = warpPerspective(img, q)!;
    expect([out.width, out.height]).toEqual([120, 80]);
    for (const [x, y] of [
      [0, 0],
      [60, 40],
      [119, 79],
      [20, 10],
    ] as const) {
      near(lum(out, x, y), lum(img, x + 40, y + 10), 2);
    }
  });

  it('respeta el lado máximo pedido', () => {
    const out = warpPerspective(scene, quad, { maxSide: 200 })!;
    expect(Math.max(out.width, out.height)).toBe(200);
  });

  it('con esquinas fuera de la imagen no produce NaN ni huecos', () => {
    const q: Quad = [
      { x: -30, y: -20 },
      { x: 300, y: -10 },
      { x: 310, y: 250 },
      { x: -20, y: 240 },
    ];
    const out = warpPerspective(createImage(280, 220, 100), q)!;
    expect(out.data.every((v) => v === 100 || v === 255)).toBe(true);
  });

  it('devuelve null con un cuadrilátero degenerado', () => {
    const p = { x: 10, y: 10 };
    expect(warpPerspective(scene, [p, p, p, p])).toBeNull();
  });
});

describe('normalización de la iluminación', () => {
  const W = 600;
  const H = 800;
  const quad: Quad = rectQuad(300, 400, 600, 800);

  // Variación del brillo del papel a lo ancho: mide cuánta sombra queda.
  function columnSpread(img: ReturnType<typeof makeScene>): number {
    const means: number[] = [];
    for (let x = 40; x < img.width - 40; x += 20) {
      // Franja libre de texto (u < 0.1 es margen izquierdo, así que se usa la franja inferior).
      const vals: number[] = [];
      for (let y = Math.floor(img.height * 0.96); y < img.height - 2; y++)
        vals.push(lum(img, x, y));
      means.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    return Math.max(...means) - Math.min(...means);
  }

  const shaded = makeScene({ width: W, height: H, quad, shadow: 0.55, noise: 4, background: 225 });

  it('reduce el gradiente de sombra del papel', () => {
    const before = columnSpread(shaded);
    const after = columnSpread(normalizeIllumination(shaded));
    expect(before).toBeGreaterThan(80);
    expect(after).toBeLessThan(before / 4);
  });

  it('el texto sigue contrastando con el papel tras nivelar', () => {
    const out = normalizeIllumination(shaded);
    // Mismo renglón de texto, a la izquierda (poca sombra) y a la derecha (mucha).
    const row = Math.floor(H * 0.3);
    let darkL = 255;
    let darkR = 255;
    for (let x = 80; x < 200; x++) darkL = Math.min(darkL, lum(out, x, row));
    for (let x = 400; x < 520; x++) darkR = Math.min(darkR, lum(out, x, row));
    expect(darkL).toBeLessThan(140);
    expect(darkR).toBeLessThan(140);
    expect(lum(out, 300, H - 4)).toBeGreaterThan(220);
  });

  it('entrega gris opaco', () => {
    const out = normalizeIllumination(shaded);
    for (let i = 0; i < out.data.length; i += 4 * 997) {
      expect(out.data[i]).toBe(out.data[i + 1]);
      expect(out.data[i + 1]).toBe(out.data[i + 2]);
      expect(out.data[i + 3]).toBe(255);
    }
  });

  it('una imagen uniforme no produce NaN y queda uniforme', () => {
    const out = normalizeIllumination(createImage(120, 90, 90));
    const first = out.data[0];
    expect(out.data.every((v, i) => (i % 4 === 3 ? v === 255 : v === first))).toBe(true);
  });
});

describe('flujo completo', () => {
  const quad: Quad = [
    { x: 520, y: 140 },
    { x: 1080, y: 190 },
    { x: 1150, y: 1060 },
    { x: 470, y: 1000 },
  ];

  it('recorta, endereza y nivela una foto grande, en menos de 1,5 s', () => {
    const big = makeScene({ width: 1600, height: 1200, quad, shadow: 0.4, noise: 8 });
    const t0 = performance.now();
    const res = scanDocument(big);
    const ms = performance.now() - t0;
    // eslint-disable-next-line no-console
    console.log(
      `scanDocument 1600x1200: ${ms.toFixed(0)} ms, salida ${res.image.width}x${res.image.height}`,
    );
    expect(res.path).toBe('cropped');
    expect(res.reason).toBeUndefined();
    const s = quadSize(quad);
    near(res.image.width / res.image.height, s.width / s.height, 0.04);
    expect(ms).toBeLessThan(1500);
  });

  it('el recorte tiene el marcador arriba a la izquierda y papel claro', () => {
    const res = scanDocument(
      makeScene({ width: 800, height: 600, quad: rectQuad(400, 300, 300, 480, 5) }),
    );
    expect(res.path).toBe('cropped');
    expect(lum(res.image, res.image.width * 0.15, res.image.height * 0.06)).toBeLessThan(80);
    expect(lum(res.image, res.image.width * 0.5, res.image.height * 0.99)).toBeGreaterThan(200);
  });

  it('sin documento detectable conserva la foto completa', () => {
    const res = scanDocument(makeNoise(640, 480));
    expect(res.path).toBe('full');
    expect(res.reason).toBe('no_document');
    expect([res.image.width, res.image.height]).toEqual([640, 480]);
  });

  it('con confianza baja no recorta aunque haya candidato', () => {
    const q = rectQuad(400, 300, 300, 450);
    const img = makeScene({ width: 800, height: 600, quad: q });
    const res = scanDocument(img, { minConfidence: 1.01 });
    expect(res.path).toBe('full');
    expect(res.reason).toBe('low_confidence');
    expect(res.corners).not.toBeNull();
    expect(res.image.width).toBe(800);
  });

  it('una imagen en blanco no se pierde ni lanza', () => {
    const res = scanDocument(createImage(300, 200, 255));
    expect(res.path).toBe('full');
    expect(res.image.width).toBe(300);
  });

  it('una imagen diminuta cae al camino completo sin error', () => {
    const res = scanDocument(createImage(4, 4, 90));
    expect(res.path).toBe('full');
    expect(res.image.width).toBe(4);
  });
});

describe('miniatura en blanco (regresión)', () => {
  it('una foto plana sin comprobante no sale blanca tras normalizar', () => {
    const flat = createImage(400, 300, 0);
    for (let i = 0; i < flat.data.length; i += 4) {
      flat.data[i] = 30;
      flat.data[i + 1] = 90;
      flat.data[i + 2] = 160;
    }
    // Sin la protección, dividir por su propio fondo la deja saturada en blanco.
    expect(whiteFraction(normalizeIllumination(flat))).toBeGreaterThan(0.99);
    const res = scanDocument(flat);
    expect(whiteFraction(res.image)).toBeLessThan(0.5);
  });

  it('un degradado de color (PNG sintético) conserva su contenido', () => {
    const g = createImage(480, 480, 0);
    for (let y = 0; y < 480; y++)
      for (let x = 0; x < 480; x++) {
        const o = (y * 480 + x) * 4;
        g.data[o] = 20 + (x / 480) * 200;
        g.data[o + 1] = 190 - (y / 480) * 150;
        g.data[o + 2] = 100 + (x / 480) * 120;
      }
    // Premisa: normalizada sin protección no queda tinta (miniatura vacía).
    expect(inkFraction(normalizeIllumination(g))).toBeLessThan(0.002);
    const res = scanDocument(g);
    expect(whiteFraction(res.image)).toBeLessThan(0.5);
  });

  it('un comprobante real sigue normalizándose a fondo blanco', () => {
    const scene = makeScene({
      width: 600,
      height: 800,
      quad: rectQuad(100, 100, 400, 600),
      shadow: 0.3,
      noise: 6,
    });
    const res = scanDocument(scene);
    expect(res.path).toBe('cropped');
    expect(whiteFraction(res.image)).toBeGreaterThan(0.3);
  });
});
