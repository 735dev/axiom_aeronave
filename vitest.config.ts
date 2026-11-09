import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // El mock de la API es el que responde: los tests no tocan red ni servidor.
    env: {
      VITE_PUBLIC_USE_MOCKS: 'true',
      VITE_PUBLIC_URL_API: 'http://aeronaves.test',
      VITE_PUBLIC_URL_VERSION: '/v1',
    },
  },
});
