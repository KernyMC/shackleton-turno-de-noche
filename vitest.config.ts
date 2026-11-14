import { defineConfig } from 'vitest/config';

// El motor es TypeScript puro: no necesita la configuración de Astro.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
