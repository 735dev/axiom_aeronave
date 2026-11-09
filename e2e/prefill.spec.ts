import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { attachReceiptWith, createWorld, type World } from './support/world';

const RECIBO = fs.readFileSync(path.join(process.cwd(), 'e2e', 'recibo.png'));

let w: World;
test.beforeAll(async () => {
  w = await createWorld();
});

test('al fotografiar el comprobante el sistema propone el renglón y marca lo leído', async ({
  page,
}) => {
  await attachReceiptWith(page, w.operationId, 'allHigh', RECIBO);
  await expect(page.getByTestId('read-amount')).toBeVisible();
  await expect(page.getByTestId('read-supplier')).toBeVisible();
  await expect(page.locator('input[name="amount"]')).not.toHaveValue('');
  await expect(page.locator('input[name="supplier"]')).not.toHaveValue('');
});

test('lo leído con confianza alta se puede guardar sin confirmar uno por uno', async ({ page }) => {
  await attachReceiptWith(page, w.operationId, 'allHigh', RECIBO);
  await expect(page.getByTestId('read-amount')).toBeVisible();
  await page.getByRole('button', { name: 'Crear' }).click();
  // El alta se completó (el diálogo se cierra) sin pedir confirmar nada.
  await expect(page.getByRole('button', { name: 'Crear' })).toHaveCount(0);
  await expect(page.getByText('Confirma los datos marcados')).toHaveCount(0);
});

test('un dato de baja confianza no deja guardar hasta confirmarlo', async ({ page }) => {
  await attachReceiptWith(page, w.operationId, 'lowAmount', RECIBO);
  await expect(page.getByText('confianza baja').first()).toBeVisible();
  await page.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByText('Confirma los datos marcados')).toBeVisible();
  // Cada confirmación saca su botón del DOM: se confirma el primero hasta que no queden.
  const confirm = page.getByRole('button', { name: 'Está bien' });
  while ((await confirm.count()) > 0) await confirm.first().click();
  await expect(page.getByText('confianza baja')).toHaveCount(0);
});

test('un comprobante ilegible avisa y deja cargar a mano sin trabar', async ({ page }) => {
  await attachReceiptWith(page, w.operationId, 'unreadable', RECIBO);
  await expect(page.getByText('No se pudo leer el comprobante')).toBeVisible();
  await expect(page.getByTestId('read-amount')).toHaveCount(0);
  await expect(page.locator('input[name="amount"]')).toBeEditable();
});

test('lo que la persona ya escribió no lo pisa la lectura', async ({ page }) => {
  await attachReceiptWith(page, w.operationId, 'legible', RECIBO, { typeAmountFirst: '12.34' });
  await expect(page.getByTestId('read-currency')).toBeVisible();
  await expect(page.locator('input[name="amount"]')).toHaveValue('12.34');
});
