import { defineConfig } from 'tsdown';

export default defineConfig({
  /*
   * Every source file is an entry, and the output mirrors `src/`.
   *
   * `src/index.ts` is still the only path a consumer imports -- the exports map
   * publishes one entry and nothing else -- but what it points at is now a
   * barrel of re-exports rather than a 215 kB single module.
   *
   * That distinction is the whole build. A bundler can drop a *module* it never
   * reaches; inside one module it has to prove every statement dead instead,
   * and a design system is exactly the shape that defeats it -- top-level
   * `tv()` recipes, an icon catalogue built by calling a factory sixty times,
   * a dialog store. One statement it cannot prove pure keeps the module, the
   * module keeps its imports, and importing `Button` ends up shipping recharts.
   * Measured, before this change: 907 kB for `Button` alone.
   *
   * Stories and tests are excluded. They are the package's tests, they import
   * Storybook and Vitest, and they are not part of what it publishes.
   */
  entry: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/*.stories.tsx',
    '!src/docs/**',
  ],
  unbundle: true,
  format: ['esm'],
  platform: 'neutral',
  dts: true,
  sourcemap: true,
  clean: true,
  /*
   * `"use client"` on every emitted file, not just the entry.
   *
   * The whole package is client code and unbundled output has no single top to
   * put the directive on: a consumer that reaches `components/button/button.js`
   * through the barrel resolves *that* file's directive, so a banner on the
   * barrel alone would say nothing about the module actually being rendered.
   */
  outputOptions: { banner: "'use client';" },
});
