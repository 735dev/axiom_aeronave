import { defineConfig } from '@playwright/test';

/**
 * Las mismas pruebas de `e2e/`, contra el backend REAL (no el simulador).
 *
 * - Backend: `scripts/real/backend.sh` (base propia, migraciones + seed, Blackbox y lector `fake`).
 *   Si ya hay uno vivo en el puerto 8100 se reutiliza.
 * - Frontend: build con `VITE_PUBLIC_USE_MOCKS=false` apuntando a ese backend.
 * - `E2E_REAL=1` hace que `e2e/support/world.ts` cree sus datos por HTTP en vez de usar el
 *   simulador; entre archivos el estado se aísla porque cada archivo crea su propia operación.
 */
const API_PORT = Number(process.env.AERO_PORT ?? 8100);
const WEB_PORT = 4174;
process.env.E2E_REAL = '1';
process.env.E2E_API_URL = `http://localhost:${API_PORT}/api/v1`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://localhost:${WEB_PORT}`, headless: true },
  webServer: [
    {
      command: 'bash scripts/real/backend.sh',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // `E2E_SKIP_BUILD=1` reutiliza `build-real/` (solo para iterar; la compuerta siempre compila).
      command:
        (process.env.E2E_SKIP_BUILD === '1'
          ? ''
          : `VITE_PUBLIC_USE_MOCKS=false VITE_PUBLIC_URL_API=http://localhost:${API_PORT}/api ` +
            `VITE_PUBLIC_URL_VERSION=/v1 npx vite build --outDir build-real && `) +
        `npx vite preview --outDir build-real --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: process.env.E2E_REUSE === '1',
      timeout: 180_000,
    },
  ],
});
