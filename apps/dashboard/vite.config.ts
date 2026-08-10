import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Where the Rust server is listening **during development only**.
 *
 * This is a Vite setting, not application config. Nothing reads it at runtime
 * and it never reaches the browser bundle: in production the server serves
 * these assets itself, so the API is same-origin and the app needs no base URL
 * at all (`baseUrl: window.location.origin`). It exists purely so that
 * `vite dev` knows where to forward, and is overridable for anyone running the
 * server on a port other than its default `8080`.
 *
 * Deliberately *not* named `RUSTRAK_API_URL`: that is the Next.js variable,
 * which the old architecture read at runtime to reach the API from a separate
 * process. Reusing the name would suggest this one does the same thing.
 */
const devProxyTarget =
  process.env.RUSTRAK_DEV_PROXY_TARGET ?? 'http://localhost:8080';

/**
 * Paths the Rust server owns. Everything else is the SPA.
 *
 * These are proxied rather than called cross-origin on purpose: the browser
 * then sees a single origin, so `rustrak_session` is sent with no CORS involved
 * and dev behaves exactly like production. Calling `:8080` directly would put
 * the browser cross-origin against a server whose CORS is `allow_any_origin()`
 * *without* `supports_credentials()`, so the cookie would never be sent at all.
 */
const serverPaths = ['/api', '/auth', '/health'];

export default defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    proxy: Object.fromEntries(
      serverPaths.map((path) => [path, { target: devProxyTarget }]),
    ),
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
});
