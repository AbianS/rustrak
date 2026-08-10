import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  dts: true,
  sourcemap: true,
  clean: true,
  // A single `"use client"` at the head of the bundle: the whole package is
  // client-side. It costs nothing and leaves the door open to consuming it from
  // something that distinguishes server from client.
  outputOptions: { banner: "'use client';" },
  // React, Base UI and the icons are resolved by the application. Bundling
  // them would duplicate React's context tree and break the hooks.
  deps: { neverBundle: [/^react/, /^react-dom/, /^@base-ui\/react/] },
});
