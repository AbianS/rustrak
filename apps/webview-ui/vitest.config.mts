import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // See vitest.server-only-stub.ts: Next resolves `server-only` itself, so
      // there is no package for Vite to find.
      'server-only': new URL('./vitest.server-only-stub.ts', import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: 'jsdom',
    // The 5s default is too tight for this suite on a cold CI runner, and the
    // failure mode is worse than a slow test: several files resolve the module
    // under test with `await import(...)` inside the first `it`, so the whole
    // cold module graph is loaded against the test's own clock. When that
    // overran, the timed-out test kept going, resolved during the *next*
    // test's window, and rendered into its DOM -- which surfaced as
    // "Found multiple elements" in a test that renders exactly one thing.
    // A GitHub runner reported `environment 72.92s` for 11 files, so this is
    // headroom for a genuinely slow machine, not cover for a slow test.
    testTimeout: 20_000,
    hookTimeout: 30_000,
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
