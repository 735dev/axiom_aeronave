import { expect, test } from '@playwright/test';
import { Api, REAL, createWorld, login, type World } from './support/world';
import { deflateSync } from 'zlib';
import { makeScene } from '../src/features/tickets/utils/scan/testScenes';
import type { Quad } from '../src/features/tickets/utils/scan/types';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** PNG RGB de 8 bits sin dependencias: lo justo para fabricar la foto de prueba. */
function encodePng(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      raw[row + 1 + x * 3] = rgba[s]!;
      raw[row + 2 + x * 3] = rgba[s + 1]!;
      raw[row + 3 + x * 3] = rgba[s + 2]!;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Ticket térmico torcido, con sombra y ruido, sobre un fondo oscuro. */
const QUAD: Quad = [
  { x: 210, y: 90 },
  { x: 640, y: 130 },
  { x: 690, y: 1020 },
  { x: 170, y: 970 },
];
const scene = makeScene({ width: 900, height: 1200, quad: QUAD, shadow: 0.4, noise: 8 });
const PHOTO = encodePng(scene.width, scene.height, scene.data);

let w: World;
test.beforeAll(async () => {
  w = await createWorld();
});

test('un ticket torcido se recorta y aparece su miniatura', async ({ page }) => {
  await login(page, 'super@transvalor.com');
  await page.goto(`/tickets/${w.openExpenseId}`);
  await expect(page.getByText(w.openExpenseCode).first()).toBeVisible();
  await page
    .getByTestId('attach-file-input')
    .setInputFiles({ name: 'ticket-torcido.png', mimeType: 'image/png', buffer: PHOTO });
  const thumb = page.locator('img[alt="ticket-torcido.jpg"]').first();
  await expect(thumb).toBeVisible();
  if (REAL) {
    // El original se sirve por enlace firmado: lo que se comprueba es lo que quedó guardado.
    const su = await Api.as('super@transvalor.com');
    const files = (await su.get(`/tickets/${w.openExpenseId}/`)).data.files as {
      name: string;
      mime: string;
    }[];
    expect(files.find((f) => f.name === 'ticket-torcido.jpg')?.mime).toBe('image/jpeg');
  } else {
    await expect(thumb).toHaveAttribute('src', /^data:image\/jpeg/);
  }
  // Detectó el borde: no hay aviso de "foto completa".
  await expect(page.getByText('No se detectó el borde del comprobante')).toHaveCount(0);
});

test('una foto sin comprobante reconocible se envía completa y avisa', async ({ page }) => {
  await login(page, 'super@transvalor.com');
  await page.goto(`/tickets/${w.openExpenseId}`);
  await expect(page.getByText(w.openExpenseCode).first()).toBeVisible();
  const blank = makeScene({ width: 400, height: 300 });
  await page.getByTestId('attach-file-input').setInputFiles({
    name: 'sin-borde.png',
    mimeType: 'image/png',
    buffer: encodePng(blank.width, blank.height, blank.data),
  });
  await expect(page.getByText('No se detectó el borde del comprobante').first()).toBeVisible();
  await expect(page.locator('img[alt="sin-borde.jpg"]').first()).toBeVisible();
});

test('varias capturas seguidas sin volver al menú', async ({ page }) => {
  await login(page, 'super@transvalor.com');
  await page.goto(`/tickets/${w.openExpenseId}`);
  await expect(page.getByText(w.openExpenseCode).first()).toBeVisible();
  const camera = page.getByTestId('attach-camera-input');
  await camera.setInputFiles({ name: 'uno.png', mimeType: 'image/png', buffer: PHOTO });
  const bar = page.getByTestId('capture-chain');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('1 fotos tomadas');
  await camera.setInputFiles({ name: 'dos.png', mimeType: 'image/png', buffer: PHOTO });
  await expect(bar).toContainText('2 fotos tomadas');
  await expect(bar.getByRole('button', { name: 'Otra foto' })).toBeEnabled();
  await bar.getByRole('button', { name: 'Listo' }).click();
  await expect(bar).toHaveCount(0);
});
