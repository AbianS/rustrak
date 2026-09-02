import { defineConfig } from 'tsdown';

export default defineConfig({
  // One output file per source file, so a consumer that imports only the
  // locale negotiation does not pull in the catalog loader.
  entry: ['src/**/*.ts', '!src/**/*.test.ts'],
  unbundle: true,
  format: ['esm'],
  // No DOM and no Node: this package runs in a browser, on a server and in
  // React Native, so it may not reach for anything platform-specific.
  platform: 'neutral',
  dts: true,
  sourcemap: true,
  clean: true,
});
