import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    // `globals` is what lets `describe`/`it`/`expect` resolve without a per-file
    // import, and it is also required by archunit's `toPassAsync` matcher, which
    // a later phase installs. Cheaper to set now than to redo the config then.
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Tests live next to the code they cover, in a `__tests__/` folder, and
    // only ever under `src/`. Scoping the glob keeps a future Playwright
    // `e2e/*.spec.ts` out of vitest, which would otherwise collect it and fail.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/e2e/**'],
  },
});
