/**
 * Stands in for `server-only` under vitest.
 *
 * `import 'server-only'` is a build-time poison pill: Next.js resolves it
 * internally and fails the build if the module reaches the client graph. There
 * is no npm package to resolve, and Vite has its own resolver, so without this
 * alias every `features/*​/data.ts` fails to load in a test.
 *
 * Aliasing it here does not weaken the guard. The guard protects the *browser
 * bundle*, which `next build` still enforces; a test importing a server module
 * into Node was never what it was defending against.
 */
export {};
