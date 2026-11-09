import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: 'http://localhost:4173', headless: true },
  // Se prueba el build real, servido como lo serviría producción.
  webServer: {
    command: 'VITE_PUBLIC_USE_MOCKS=true npx vite build && npx vite preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
