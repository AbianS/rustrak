import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Node, and no jsdom.
 *
 * What is worth testing in this application is the part that decides who gets
 * in: the session store's three-way reading of the server, and the sanitiser
 * that stands between a URL and a redirect. Neither needs a DOM, and both are
 * kept in `lib/auth-store.ts` precisely so they can be reached without one.
 *
 * The components are not tested here on purpose. They are `@rustrak/ui` pieces
 * arranged in a layout, and that package already runs every one of them as a
 * component test in a real Chromium; a second, thinner harness in this app
 * would re-test the design system through a jsdom that cannot see any of it.
 */
export default defineConfig({
  test: {
    name: 'dashboard',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
});
