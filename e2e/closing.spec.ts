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

  await expect(page.getByTestId('close-operation')).toBeDisabled();
  await expect(page.getByTestId('closing-reason')).toContainText('No se puede cerrar');
  // Sigue abierta: no hay sello.
  await expect(page.getByTestId('closing-stamp')).toHaveCount(0);

  // El cierre pide cuatro firmas: capitán, mantenimiento, AVSEC y gerencia general.
  const signers = page.getByTestId('closing-signers');
  await expect(signers).toBeVisible();
  for (const step of ['sign_captain', 'sign_maintenance', 'sign_avsec', 'sign_general']) {
    await expect(page.getByTestId(`signer-${step}`)).toHaveAttribute('data-state', /mine|pending/);
  }
});

test('el piloto firma su paso del cierre y queda registrado, sin poder firmar el de otro', async ({
  page,
}) => {
  await login(page, 'piloto@transvalor.com');
  await page.goto('/perfil');
  await page.getByTestId('signature-input').setInputFiles(FIRMA);
  await expect(page.getByTestId('signature-preview')).toBeVisible();

  // Navegación interna (sin recargar): el simulador guarda su estado en memoria y la firma recién cargada se perdería.
  await page.evaluate((id) => {
    window.history.pushState({}, '', `/tickets/${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, w.operationId);
  await expect(page.getByTestId('closing-signers')).toBeVisible();
  // Solo el paso de su rol ofrece "Firmar".
  await expect(page.getByTestId('sign-sign_captain')).toBeEnabled();
  await expect(page.getByTestId('sign-sign_maintenance')).toHaveCount(0);
  await expect(page.getByTestId('sign-sign_avsec')).toHaveCount(0);
  await expect(page.getByTestId('sign-sign_general')).toHaveCount(0);

  await page.getByTestId('sign-sign_captain').click();
  await expect(page.getByTestId('signer-sign_captain')).toHaveAttribute('data-state', 'signed');
  await expect(page.getByTestId('sign-sign_captain')).toHaveCount(0);
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
