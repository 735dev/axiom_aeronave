import { expect, test } from '@playwright/test';
import path from 'path';
import { createWorld, login, type World } from './support/world';

const FIRMA = path.join(process.cwd(), 'e2e', 'firma.png');

let w: World;
test.beforeAll(async () => {
  w = await createWorld();
});

test('Gerencia de Operaciones carga su firma y ve por qué la operación abierta no se puede cerrar', async ({
  page,
}) => {
  await login(page, 'operaciones@transvalor.com');

  await page.goto('/perfil');
  await expect(page.getByTestId('signature-empty')).toBeVisible();
  await page.getByTestId('signature-input').setInputFiles(FIRMA);
  await expect(page.getByTestId('signature-preview')).toBeVisible();
  await expect(page.getByTestId('signature-preview')).toHaveAttribute('src', /^data:image\/png/);

  // La operación abierta de los datos de ejemplo tiene hijos sin resolver.
  await page.goto(`/tickets/${w.operationId}`);
  const panel = page.getByTestId('closing-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('closing-progress-row').first()).toBeVisible();

  const blockers = page.getByTestId('closing-blockers');
  await expect(blockers.getByRole('link', { name: w.blockerCode })).toBeVisible();

  await expect(page.getByTestId('sign-and-close')).toBeDisabled();
  await expect(page.getByTestId('closing-reason')).toContainText('No se puede cerrar');
  // Sigue abierta: no hay sello.
  await expect(page.getByTestId('closing-stamp')).toHaveCount(0);
});

test('un archivo que no es PNG ni JPEG se rechaza en el perfil', async ({ page }) => {
  await login(page, 'piloto@transvalor.com');
  await page.goto('/perfil');
  await page.getByTestId('signature-input').setInputFiles({
    name: 'firma.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('GIF89a'),
  });
  await expect(page.getByText('La firma debe ser una imagen PNG o JPEG.')).toBeVisible();
  await expect(page.getByTestId('signature-preview')).toHaveCount(0);
});
