import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'i18n',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
});
