import { expect, test } from '@playwright/test';
import { createWorld, login } from './support/world';

test('el constructor deja marcar qué campo es el monto y un rol no se repite', async ({ page }) => {
  await login(page, 'super@transvalor.com');
  await page.getByRole('link', { name: 'Catálogos' }).click();
  await page.getByText('Tipos de ticket').first().click();
  await page
    .getByRole('button', { name: /Editar formulario/ })
    .first()
    .click();
  await page.getByRole('button', { name: /^Campos/ }).click();
  // Cada selector de rol está en un bloque con ese rótulo.
  const roles = page.locator('div:has(> label:text-is("Qué representa para el sistema")) > select');
  await expect(roles.first()).toBeVisible();
  const count = await roles.count();
  expect(count).toBeGreaterThan(2);
  // Asignar 'Monto' a otro campo se lo quita al que lo tenía.
  const withAmount = async () => {
    let n = 0;
    for (let i = 0; i < count; i += 1) if ((await roles.nth(i).inputValue()) === 'amount') n += 1;
    return n;
  };
  await roles.nth(0).selectOption('amount');
  await roles.nth(1).selectOption('amount');
  expect(await withAmount()).toBe(1);
  expect(await roles.nth(1).inputValue()).toBe('amount');
  expect(await roles.nth(0).inputValue()).not.toBe('amount');
});
