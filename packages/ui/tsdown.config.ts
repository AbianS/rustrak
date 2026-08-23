import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  dts: true,
  sourcemap: true,
  clean: true,
  // One `"use client"` at the top of the bundle. The whole package is client
  // code, so the consuming framework does not have to resolve it per module.
  outputOptions: { banner: "'use client';" },
  // React, Base UI and the icon library are resolved by the application.
  // Bundling them would duplicate React's context tree and break every hook.
  deps: { neverBundle: [/^react/, /^react-dom/, /^@base-ui\/react/] },
});
