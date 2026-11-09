import { expect, test } from '@playwright/test';
import path from 'path';
import { REAL, createWorld, login, type World } from './support/world';

const RECIBO = path.join(process.cwd(), 'e2e', 'recibo.png');

let w: World;
test.beforeAll(async () => {
  w = await createWorld();
});

test('adjunto de un gasto abierto va a Blackbox y se ve con su enlace', async ({ page }) => {
  await login(page, 'super@transvalor.com');
  await page.goto(`/tickets/${w.openExpenseId}`);
  await expect(page.getByText(w.openExpenseCode).first()).toBeVisible();
  const link = REAL
    ? page.waitForResponse((r) => /\/attachments\/[^/]+\/download\/$/.test(r.url()))
    : null;
  await page.getByTestId('attach-file-input').setInputFiles(RECIBO);
  const thumb = page.locator('img[alt="recibo.jpg"]').first();
  await expect(thumb).toBeVisible();
  // El original no viaja con el ticket: se muestra desde el enlace firmado.
  if (link) {
    const signed = (await (await link).json()) as { url: string; expires_at: string };
    expect(signed.expires_at).toBeTruthy();
    await expect(thumb).toHaveAttribute('src', signed.url);
  } else {
    await expect(thumb).toHaveAttribute('src', /^data:image\//);
  }
});

test('un expediente cerrado se puede consultar pero no modificar', async ({ page }) => {
  await login(page, 'super@transvalor.com');
  await page.goto(`/tickets/${w.closedExpenseId}`);
  await expect(
    page.getByText('Este expediente está cerrado. Solo se puede consultar.'),
  ).toBeVisible();
  await expect(page.getByTestId('attach-file-input')).toHaveCount(0);
});

test('un archivo con extensión no admitida se rechaza antes de enviarse', async ({ page }) => {
  await login(page, 'super@transvalor.com');
  await page.goto(`/tickets/${w.openExpenseId}`);
  await expect(page.getByText(w.openExpenseCode).first()).toBeVisible();
  await page.getByTestId('attach-file-input').setInputFiles({
    name: 'virus.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('MZ'),
  });
  await expect(page.getByText('Solo se admiten PDF, Word o imágenes.')).toBeVisible();
});
