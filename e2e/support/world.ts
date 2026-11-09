import { expect, type Page } from '@playwright/test';
import { deflateSync } from 'zlib';

/**
 * Los mismos escenarios corren contra dos mundos:
 *  - simulador en memoria (`npm run test:e2e`): datos fijos de `ticketsDb.ts`;
 *  - backend real (`npm run test:e2e:real`, `E2E_REAL=1`): cada archivo crea por HTTP su propia
 *    operación, así un archivo no depende de lo que dejó otro.
 */
export const REAL = process.env.E2E_REAL === '1';
const API = process.env.E2E_API_URL ?? 'http://localhost:8100/api/v1';

export interface World {
  /** Operación abierta con hijos sin resolver. */
  operationId: string;
  /** Código de un hijo que bloquea el cierre de la operación. */
  blockerCode: string;
  /** Gasto abierto, que admite soportes. */
  openExpenseId: string;
  openExpenseCode: string;
  /** Gasto en estado final, con soporte: solo se consulta. */
  closedExpenseId: string;
}

// ---------------------------------------------------------------------------
// HTTP mínimo contra el backend real
// ---------------------------------------------------------------------------

export class Api {
  private constructor(private readonly token: string) {}

  static async as(email: string, password = 'demo1234'): Promise<Api> {
    const res = await fetch(`${API}/auth/login/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`login ${email}: ${res.status} ${await res.text()}`);
    return new Api(((await res.json()) as { token: string }).token);
  }

  async call<T = any>(
    method: string,
    path: string,
    body?: unknown,
    expect2xx = true,
  ): Promise<{ status: number; data: T }> {
    const isForm = body instanceof FormData;
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(body !== undefined && !isForm ? { 'content-type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const text = await res.text();
    const data = (
      text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text
    ) as T;
    if (expect2xx && !res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`);
    return { status: res.status, data };
  }

  get<T = any>(path: string) {
    return this.call<T>('GET', path);
  }
  post<T = any>(path: string, body?: unknown) {
    return this.call<T>('POST', path, body);
  }
  patch<T = any>(path: string, body?: unknown) {
    return this.call<T>('PATCH', path, body);
  }
  put<T = any>(path: string, body?: unknown) {
    return this.call<T>('PUT', path, body);
  }

  async upload(ticketId: string, file: Buffer, name: string, fieldKey: string, key?: string) {
    const form = new FormData();
    form.append('file', new Blob([file], { type: 'image/png' }), name);
    form.append('field_key', fieldKey);
    const res = await fetch(`${API}/tickets/${ticketId}/attachments/`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      body: form,
    });
    if (!res.ok) throw new Error(`upload ${name}: ${res.status} ${await res.text()}`);
    return (await res.json()) as any;
  }
}

// ---------------------------------------------------------------------------
// PNG sintético: cada semilla da bytes distintos (y por tanto otra lectura del lector `fake`)
// ---------------------------------------------------------------------------

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
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

/** Recibo de 96x128 con ruido determinista por semilla: una foto distinta por número. */
export function receiptPng(seed: number): Buffer {
  const w = 96;
  const h = 128;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let s = (seed * 2654435761) >>> 0;
  for (let y = 0; y < h; y += 1) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w * 3; x += 1) {
      s = (s * 1664525 + 1013904223) >>> 0;
      raw[row + 1 + x] =
        y > 8 && y < h - 8 && x > 12 && x < w * 3 - 12 ? 190 + (s >>> 28) : 40 + (s >>> 28);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Firma de prueba: un PNG pequeño y válido. */
export function signaturePng(): Buffer {
  return receiptPng(424242);
}

// ---------------------------------------------------------------------------
// Datos de cada archivo de pruebas
// ---------------------------------------------------------------------------

export async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill('demo1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/tickets');
}

const MOCK_WORLD: World = {
  operationId: 'op-4',
  blockerCode: 'TK-0003',
  openExpenseId: 'tk-exp-2',
  openExpenseCode: 'TK-0002',
  closedExpenseId: 'tk-exp-1',
};

let seq = 0;

/**
 * Crea (en real) una operación abierta de la aeronave del piloto, con un gasto abierto y otro
 * cerrado. La operación nace con su reporte técnico abierto: ese hijo es el que bloquea el cierre.
 */
export async function createWorld(): Promise<World> {
  if (!REAL) return MOCK_WORLD;
  const su = await Api.as('super@transvalor.com');
  const stamp = `${Date.now()}-${(seq += 1)}`;
  const op = (
    await su.post('/tickets/', {
      type_code: 'operation',
      title: `E2E ${stamp}`,
      payload: {
        date: new Date().toISOString().slice(0, 10),
        aircraft: 'YV2323',
        origin: 'CCS',
        destination: 'PZO',
        exchange_rate: 40,
      },
    })
  ).data;

  const expense = async (title: string) =>
    (
      await su.post('/tickets/', {
        type_code: 'expense',
        title,
        parent_id: op.id,
        payload: { concept: 'fuel', amount: 25, currency: 'USD' },
      })
    ).data;
  const open = await expense('Gasto abierto');
  const done = await expense('Gasto cerrado');
  await su.upload(done.id, receiptPng(1), 'cerrado.png', 'support');
  await su.patch(`/tickets/${done.id}/`, { status_code: 'verified' });

  const children = (await su.get(`/tickets/?parent_id=${op.id}&limit=50`)).data.data as any[];
  const blocker = children.find((c) => c.type_code === 'technical_report');
  if (!blocker) throw new Error('la operación no creó su reporte técnico');
  return {
    operationId: op.id,
    blockerCode: blocker.code,
    openExpenseId: open.id,
    openExpenseCode: open.code,
    closedExpenseId: done.id,
  };
}

// ---------------------------------------------------------------------------
// Lectura de comprobantes
// ---------------------------------------------------------------------------

export type Reading = 'allHigh' | 'lowAmount' | 'legible' | 'unreadable';

const RECIBO_MOCK_SEED = {
  legible: (s: number) => s % 7 !== 0,
  lowAmount: (s: number) => s % 7 !== 0 && s % 5 === 0,
  allHigh: (s: number) => s % 7 !== 0 && s % 5 !== 0 && s % 4 !== 0 && s % 6 !== 0 && s % 8 !== 0,
  unreadable: (s: number) => s % 7 === 0,
};

function mockSeed(name: string, size: number): number {
  const text = name + size;
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function classify(extraction: {
  status: string;
  fields: { key: string; confidence: string }[];
}): Reading[] {
  if (extraction.status === 'unreadable') return ['unreadable'];
  const out: Reading[] = ['legible'];
  if (extraction.fields.every((f) => f.confidence === 'high')) out.push('allHigh');
  if (extraction.fields.find((f) => f.key === 'amount')?.confidence === 'low')
    out.push('lowAmount');
  return out;
}

async function openNewExpenseDialog(page: Page, operationId: string) {
  await page.goto(`/tickets/${operationId}`);
  await page.getByRole('button', { name: 'Agregar' }).first().click();
  await page.getByRole('button', { name: /^Gasto/ }).click();
}

/**
 * Abre "Agregar gasto" en la operación y adjunta una foto cuya lectura sea la pedida.
 *
 * Simulador: el nombre elige la lectura (semilla del nombre). Real: el lector `fake` decide por el
 * hash de los bytes, que ni el cliente ni la prueba controlan (la foto se recomprime), así que se
 * prueban fotos distintas hasta que la respuesta REAL de `/attachments/extract/` sea la buscada.
 * Una lectura que nunca coincide hace fallar la prueba: no se sustituye por otra.
 */
export async function attachReceiptWith(
  page: Page,
  operationId: string,
  want: Reading,
  recibo: Buffer,
  opts: {
    typeAmountFirst?: string;
    /** Página ya autenticada (con otro usuario); por defecto entra como superusuario. */
    as?: Page;
  } = {},
): Promise<void> {
  if (!opts.as) await login(page, 'super@transvalor.com');
  const typeAmount = async () => {
    if (opts.typeAmountFirst) await page.locator('input[name="amount"]').fill(opts.typeAmountFirst);
  };

  if (!REAL) {
    let name = '';
    for (let i = 0; i < 500 && !name; i += 1) {
      const candidate = `recibo-${i}.png`;
      // La foto se reenvía como JPEG: la lectura ve el nombre ya con .jpg.
      if (RECIBO_MOCK_SEED[want](mockSeed(`recibo-${i}.jpg`, recibo.length))) name = candidate;
    }
    if (!name) throw new Error('no hay nombre con esa lectura');
    await openNewExpenseDialog(page, operationId);
    await typeAmount();
    await page
      .getByTestId('pending-file-input')
      .setInputFiles({ name, mimeType: 'image/png', buffer: recibo });
    return;
  }

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    await openNewExpenseDialog(page, operationId);
    await typeAmount();
    const response = page.waitForResponse((r) => r.url().includes('/attachments/extract/'));
    await page.getByTestId('pending-file-input').setInputFiles({
      name: `recibo-${attempt}.png`,
      mimeType: 'image/png',
      buffer: receiptPng(attempt * 7919),
    });
    const body = (await (await response).json()) as Parameters<typeof classify>[0];
    if (classify(body).includes(want)) return;
    await page.keyboard.press('Escape');
  }
  throw new Error(`el lector real no devolvió una lectura "${want}" en 60 fotos distintas`);
}

export { expect };
