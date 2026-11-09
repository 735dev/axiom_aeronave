import { expect, test } from '@playwright/test';
import { createWorld, login } from './support/world';

test.beforeAll(async () => {
  await createWorld();
});

test.use({ viewport: { width: 360, height: 740 } });

test('el piloto registra la bitácora con novedad en pocos toques y llega al expediente', async ({
  page,
}) => {
  await login(page, 'piloto@transvalor.com');
  await page.goto('/bitacora-rapida');

  // La operación abierta de su aeronave ya viene elegida.
  await expect(page.getByTestId('quicklog-operation')).not.toHaveValue('');

  await page.getByTestId('quicklog-departure').fill('08:00');
  await page.getByTestId('quicklog-arrival-now').click();
  await page.getByTestId('quicklog-arrival').fill('09:30');

  await page.getByTestId('quicklog-finding').click();
  await page.getByTestId('quicklog-chip-engine').click();
  await expect(page.getByTestId('quicklog-note')).toHaveValue('Motor');

  await page.getByTestId('quicklog-save').click();
  await expect(page.getByText('Bitácora guardada')).toBeVisible();

  await page.getByRole('link', { name: /Ver expediente/ }).click();
  await page.waitForURL(/\/tickets\/[^/?]+$/);
  await expect(page.getByText('Reporte técnico').first()).toBeVisible();
});

test('una llegada anterior a la salida se explica y no guarda nada', async ({ page }) => {
  await login(page, 'piloto@transvalor.com');
  await page.goto('/bitacora-rapida');
  await expect(page.getByTestId('quicklog-operation')).not.toHaveValue('');
  await page.getByTestId('quicklog-departure').fill('22:00');
  await page.getByTestId('quicklog-arrival').fill('01:10');
  await page.getByTestId('quicklog-save').click();
  await expect(page.getByText(/Llegó al día siguiente/).first()).toBeVisible();
  await expect(page.getByText('Bitácora guardada')).toHaveCount(0);

  // Con "Llegó al día siguiente" el mismo horario es válido.
  await page.getByTestId('quicklog-nextday').click();
  await page.getByTestId('quicklog-save').click();
  await expect(page.getByText('Bitácora guardada')).toBeVisible();
});
