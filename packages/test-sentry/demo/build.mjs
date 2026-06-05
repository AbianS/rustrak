import { sentryEsbuildPlugin } from '@sentry/esbuild-plugin';
import { build } from 'esbuild';

const authToken = process.env.SENTRY_AUTH_TOKEN;
const org = process.env.SENTRY_ORG ?? 'my-org';
const project = process.env.SENTRY_PROJECT ?? 'my-project';
const url = process.env.SENTRY_URL ?? 'http://localhost:8080';

if (!authToken) {
  console.error('SENTRY_AUTH_TOKEN is required');
  process.exit(1);
}

console.log(`Building demo app and uploading source maps to ${url}...`);
console.log(`  org=${org}  project=${project}`);

await build({
  entryPoints: ['demo/src/app.ts'],
  bundle: true,
  minify: true,
  keepNames: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outfile: 'demo/dist/app.js',
  external: ['@sentry/*'],
  sourcemap: true,
  plugins: [
    sentryEsbuildPlugin({
      authToken,
      org,
      project,
      url,
      telemetry: false,
      silent: false,
      release: {
        create: false,
        finalize: false,
      },
    }),
  ],
});

console.log('\nBuild complete. Run the demo with:');
console.log(`  SENTRY_DSN=<dsn> node demo/dist/app.js`);
