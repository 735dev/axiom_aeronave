import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { attachReceiptWith, createWorld, type World } from './support/world';

const RECIBO = fs.readFileSync(path.join(process.cwd(), 'e2e', 'recibo.png'));

let w: World;
test.beforeAll(async () => {
  w = await createWorld();
});

test('la consola no deja aprobar un dato dudoso sin revisarlo', async ({ page }) => {
  await attachReceiptWith(page, w.operationId, 'lowAmount', RECIBO);
  await expect(page.getByText('confianza baja').first()).toBeVisible();
  // Cada confirmación saca su botón del DOM: se confirma el primero hasta que no queden.
  const confirm = page.getByRole('button', { name: 'Está bien' });
  while ((await confirm.count()) > 0) await confirm.first().click();
  await page.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByText('Confirma los datos marcados')).toHaveCount(0);

  // Navegación interna: el simulador vive en memoria y recargar la página lo reinicia.
  await page.getByRole('link', { name: 'Validación' }).click();
  const approve = page.getByRole('button', { name: /Aprobar/ });
  await expect(approve).toBeDisabled();
  // En el servidor real la cola trae lo de otras corridas: se marcan todas las dudas del
  // comprobante que esté al frente, sea cual sea.
  const boxes = page.locator('[data-testid^="seen-"]');
  const total = await boxes.count();
  expect(total).toBeGreaterThan(0);
  for (let i = 0; i < total; i += 1) await boxes.nth(i).check();
  await expect(approve).toBeEnabled();
  await boxes.first().uncheck();
  await expect(approve).toBeDisabled();
});
