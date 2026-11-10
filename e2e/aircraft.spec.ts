import { expect, test } from '@playwright/test';
import { login, REAL } from './support/world';

// Los códigos de marca y modelo son los del simulador; el backend real trae los suyos.
test.skip(REAL, 'usa los catálogos del simulador');

async function openNewOperation(page: import('@playwright/test').Page) {
  await login(page, 'operaciones@transvalor.com');
  await page
    .getByRole('button', { name: /Nuevo|Nueva/ })
    .first()
    .click();
  await page.getByRole('button', { name: /^Operación aérea/ }).click();
  await page.locator('input[name="date"]').fill('2026-12-10');
  await page.locator('select[name="origin"]').selectOption('CCS');
  await page.locator('select[name="destination"]').selectOption('PZO');
}

test('al elegir la matrícula se llenan marca y modelo, y se pueden cambiar con coherencia', async ({
  page,
}) => {
  await openNewOperation(page);
  const brand = page.locator('select[name="aircraft_brand"]');
  const model = page.locator('select[name="aircraft_model"]');

  await page.locator('select[name="aircraft"]').selectOption('YV2323');
  await expect(brand).toHaveValue('beechcraft');
  await expect(model).toHaveValue('king_air_200');

  // El modelo solo ofrece los de la marca elegida.
  await expect(model.locator('option[value="cheyenne"]')).toHaveCount(0);

  // Cambiar la marca limpia un modelo que ya no corresponde.
  await brand.selectOption('piper');
  await expect(model).toHaveValue('');
  await expect(model.locator('option[value="cheyenne"]')).toHaveCount(1);

  // Otra matrícula vuelve a proponer su marca y su modelo.
  await page.locator('select[name="aircraft"]').selectOption('YV2528');
  await expect(brand).toHaveValue('piper');
  await expect(model).toHaveValue('cheyenne');
});

test('un modelo que no corresponde a la matrícula se rechaza con el error en el campo', async ({
  page,
}) => {
  await openNewOperation(page);
  await page.locator('select[name="aircraft"]').selectOption('YV2323');
  await expect(page.locator('select[name="aircraft_model"]')).toHaveValue('king_air_200');

  // Marca y modelo coherentes entre sí, pero de otra aeronave que la matrícula.
  await page.locator('select[name="aircraft_brand"]').selectOption('piper');
  await page.locator('select[name="aircraft_model"]').selectOption('cheyenne');
  await page.getByRole('button', { name: 'Crear' }).click();

  await expect(page.getByText('La matrícula no corresponde a este modelo.').first()).toBeVisible();
});
