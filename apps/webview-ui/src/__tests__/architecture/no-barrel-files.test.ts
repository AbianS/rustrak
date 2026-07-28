import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';

/**
 * No barrel files. Ever.
 *
 * Feature-Sliced Design gives every slice an `index.ts` as its public surface,
 * and this codebase deliberately does not. The reason is recorded in the spec
 * and it is not a preference: it was tried on the `issue` pilot and **the build
 * failed with 11 errors**. A barrel that re-exports both `api/queries.ts`
 * (`import 'server-only'`) and `ui/issues-list.tsx` (`'use client'`) drags the
 * server-only poison pill into every client component that imports anything at
 * all from the slice. Splitting it into a client-safe barrel and a server-only
 * one is two barrels, which is worse than none.
 *
 * The generic case holds too -- barrels defeat tree-shaking, invite import
 * cycles, and make a bundler resolve a whole slice to fetch one component --
 * but the poison pill is what makes this specific to a React Server Components
 * codebase and therefore permanent here.
 *
 * What replaces the guarantee a barrel would give: the **segment** is the
 * boundary, not the file. `features/issue/ui/…` is public by convention, and
 * [slice-isolation](./slice-isolation.test.ts) is what actually keeps slices
 * apart. The accepted cost is that internals are not private, so renaming a
 * file inside a slice touches its importers.
 */

describe('no barrel files', () => {
  /**
   * The population, asserted through a rule that must find plenty.
   *
   * `shouldNot().haveName('index.ts')` passes when the tree has no barrels and
   * also when the glob matched no files whatsoever. archunit guards the second
   * case itself -- an empty match raises `EmptyTestViolation` rather than
   * passing -- but that guard fires on *zero*, not on "one file out of two
   * hundred". This asserts the real size: 150 `.tsx` files were under `src/` at
   * the end of phase 6, so the glob is reaching the whole tree.
   */
  it('reaches the population it expects to reach', async () => {
    const everyComponent = await projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .haveName('*.tsx')
      .check();

    expect(everyComponent.length).toBeGreaterThanOrEqual(140);
  });

  it('has no index.ts anywhere under src/', async () => {
    const rule = projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .haveName('index.ts');

    await expect(rule).toPassAsync();
  });

  it('has no index.tsx anywhere under src/', async () => {
    const rule = projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .haveName('index.tsx');

    await expect(rule).toPassAsync();
  });
});
