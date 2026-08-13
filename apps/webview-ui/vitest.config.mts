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
    /**
     * Sequential files, one shared module registry, and it is a **20x
     * reduction in work** rather than a scheduling preference.
     *
     * archunit resolves the import graph by building a TypeScript program, and
     * caches it at module scope. Vitest's default is a fresh module registry per
     * test file, so nine rule files meant nine full extractions of the same
     * program: 32s of CPU. Sharing the registry means it is built once and the
     * other eight files read the cache -- 1.6s.
     *
     * This surfaced as a CI failure, not as slowness. Locally the 32s spread
     * across 7 cores and the suite finished in 4.5s; a 2-core GitHub runner has
     * no such luxury, so individual population tests took 22.8s and tripped the
     * timeout while every rule they guard passed.
     *
     * Safe here because nothing in this suite has mutable state to leak: the
     * rules read files and assert. A future test that stubs a global would need
     * to opt back into isolation, and should say so where it does.
     */
    isolate: false,
    fileParallelism: false,
    // Node, not jsdom. Nothing here touches a DOM.
    environment: 'node',
    // `globals` is required by archunit's `toPassAsync` matcher, which the
    // rules assert with. Not a convenience.
    globals: true,
    // The architecture rules, plus unit tests for the portable core: a
    // feature's `model` and `lib` segments, and `shared/lib`.
    //
    // That second entry is the narrowest widening that lets domain logic be
    // test-driven. Those folders are already forbidden from importing `next`
    // or React by the `portable-core` rule, so a test for one runs on plain
    // Node and needs none of the harness described above as deliberately
    // absent -- no jsdom, no React plugin, no testing-library, no
    // `server-only` alias. A *rendering* test still needs all of it, and
    // still has to arrive in the commit that needs it.
    //
    // Anywhere else, a `.test.ts` is still not collected.
    include: [
      'src/__tests__/architecture/**/*.test.ts',
      'src/{features/*/{model,lib},shared/lib}/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/e2e/**'],
    // Whichever test runs first pays for the whole graph extraction; the rest
    // cost milliseconds. That one test needs room on a cold runner, and since
    // the suite now finishes in under two seconds, a generous ceiling costs
    // nothing and a tight one costs a red build.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
