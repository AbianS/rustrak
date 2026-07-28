import { defineConfig } from 'vitest/config';

/**
 * This project runs **architecture tests only**.
 *
 * The page, component and action tests were deleted deliberately: the structure
 * is still moving, and a test asserting where a component sits is worth less
 * than the rule that decides it. They come back in their own pass once the
 * shape has settled.
 *
 * That is why nothing here resembles a normal React test setup any more. The
 * rules never render, never mount and never import a source module -- archunit
 * reads files as text and resolves the import graph through the TypeScript
 * program -- so the whole of it went with the tests: jsdom, the React plugin,
 * the testing-library setup, the `matchMedia` and `ResizeObserver` stubs, and
 * the `server-only` alias that let a test load a server module in Node.
 *
 * Restoring any of it is a decision about tests, not about config, and should
 * arrive in the commit that needs it.
 */
export default defineConfig({
  test: {
    // Node, not jsdom. Nothing here touches a DOM.
    environment: 'node',
    // `globals` is required by archunit's `toPassAsync` matcher, which the
    // rules assert with. Not a convenience.
    globals: true,
    // Scoped to the one folder that holds rules, so a `.test.ts` added
    // anywhere else is not silently collected into this suite.
    include: ['src/__tests__/architecture/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/e2e/**'],
    // The rules walk the tree and build a TypeScript program; the 5s default is
    // too tight for that on a cold CI runner. A GitHub runner has reported ~70s
    // for the environment alone, so this is headroom for a slow machine rather
    // than cover for a slow test.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
