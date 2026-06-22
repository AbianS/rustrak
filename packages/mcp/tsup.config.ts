import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  shims: true,
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  outDir: 'dist',
  banner: {
    js: '#!/usr/bin/env node',
  },
});
