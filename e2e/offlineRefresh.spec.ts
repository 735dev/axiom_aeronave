import { expect, test, type Page } from '@playwright/test';
import { REAL, createWorld, login } from './support/world';

/** Navegación interna del router: recargar sin red no serviría la app. */
const goClient = (page: Page, url: string) =>
  page.evaluate((to) => {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, url);

test.beforeAll(async () => {
  await createWorld();
});

test.use({ viewport: { width: 360, height: 740 } });

// Solo simulador: aquí se corta la red del navegador; en real no hay API caída que simular.
test.skip(REAL, 'la caída de red se simula solo contra el simulador');

test('al volver la red la cola sincroniza y la lista se refresca sola', async ({
  page,
  context,
}) => {
  await login(page, 'piloto@transvalor.com');
  // Se visitan ambas pantallas con red para que sus módulos queden cargados.
  await page.goto('/bitacora-rapida');
  await expect(page.getByTestId('quicklog-operation')).not.toHaveValue('');
  await goClient(page, '/tickets?vista=work');
  const rows = page.locator('a[href^="/tickets/"]');
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();

  // Sin señal: se guarda una bitácora desde la pantalla rápida (navegación interna, sin recargar).
  await context.setOffline(true);
  await goClient(page, '/bitacora-rapida');
  await expect(page.getByTestId('quicklog-operation')).not.toHaveValue('');
  await page.getByTestId('quicklog-departure').fill('08:00');
  await page.getByTestId('quicklog-arrival').fill('09:30');
  await page.getByTestId('quicklog-save').click();
  await expect(page.getByText(/Sin señal/).first()).toBeVisible();

  // De vuelta en la lista (aún sin red) no aparece nada nuevo.
  await goClient(page, '/tickets?vista=work');
  await expect(page.locator('a[href^="/tickets/"]').first()).toBeVisible();
  expect(await page.locator('a[href^="/tickets/"]').count()).toBe(before);

  // Vuelve la red: se sincroniza y la lista abierta se relee sin tocar nada.
  await context.setOffline(false);
  await expect(page.getByText(/sincronizado/).first()).toBeVisible();
  await expect(page.locator('a[href^="/tickets/"]')).toHaveCount(before + 1);
});
