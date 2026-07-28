import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';
import { isTestFile, withoutComments } from './predicates';

/**
 * AD-9 rule (10): the `'use server'` directive appears only in a slice's `api`
 * segment, and only in `mutations.ts`.
 *
 * The directive is what turns a module's exports into public POST endpoints.
 * Confining it is what makes "which of our functions are reachable from the
 * internet" answerable by listing files rather than by grepping and hoping.
 *
 * **The segment check alone was not enough, and this is not hypothetical.**
 * `storage` shipped a single `api/storage.ts` carrying one `'use server'` over
 * both its reads and its writes. It sat in an `api` segment, so the rule passed
 * -- while `getStorageSummary` and `getStorageProjects`, called only from a
 * Server Component, were public endpoints nothing needed. The filename rules
 * below are what close that.
 *
 * So an `api` segment holds exactly two filenames, and each one owns a
 * directive:
 *
 * - `queries.ts` -- `import 'server-only'`. A build-time poison pill: the
 *   module cannot reach the browser bundle, and reads do not need it to.
 * - `mutations.ts` -- `'use server'`. The browser genuinely calls these.
 *
 * **The split is by who calls it, not by what it does to the database.**
 * `previewStorageCleanup` mutates nothing and belongs in `mutations.ts` all the
 * same, because a `'use client'` component invokes it and a `server-only`
 * module would not be reachable from there.
 */

const USE_SERVER = /^\s*(['"])use server\1/m;
const SERVER_ONLY = /^\s*import\s+(['"])server-only\1/m;

const posix = (path: string) => path.split('\\').join('/');

const API_FILE = /(^|\/)features\/[^/]+\/api\/([^/]+)\.ts$/;

/** The filename within an `api` segment, or `null` if the file is not in one. */
const apiFilename = (path: string) => API_FILE.exec(posix(path))?.[2] ?? null;

describe('AD-9 rule (10): where `use server` may appear', () => {
  // archunit reports an `EmptyTestViolation` when its filters match nothing,
  // but it does not expose *how many* it matched. AD-9 requires a floor that is
  // a specific number, on every rule whatever the mechanism, so the population
  // is asserted separately -- through `projectFiles` all the same, so it counts
  // the files the rule below will actually judge.
  it('reads the population it expects to read', async () => {
    const withDirective = await projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo(
        (file) =>
          !isTestFile(file.path) &&
          USE_SERVER.test(withoutComments(file.content)),
        'counted',
      )
      .check();

    // 6: the `mutations.ts` of alert, issue, project, storage, token and user.
    // Five slices have no mutations at all -- nothing in the product writes an
    // agent trace or a log -- and that is the shape, not a gap.
    expect(withDirective.length).toBeGreaterThanOrEqual(6);
  });

  it('has no `use server` outside an api segment', async () => {
    const rule = projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo(
        (file) =>
          !isTestFile(file.path) &&
          USE_SERVER.test(withoutComments(file.content)) &&
          apiFilename(file.path) == null,
        'declares `use server` outside features/*/api/',
      );

    await expect(rule).toPassAsync();
  });

  it('has no file in an api segment other than queries.ts or mutations.ts', async () => {
    const rule = projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo((file) => {
        if (isTestFile(file.path)) return false;
        const name = apiFilename(file.path);
        return name != null && name !== 'queries' && name !== 'mutations';
      }, 'sits in an api segment under a name that carries no directive contract: use queries.ts or mutations.ts');

    await expect(rule).toPassAsync();
  });

  it('has no queries.ts that is not server-only', async () => {
    const rule = projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo(
        (file) =>
          apiFilename(file.path) === 'queries' &&
          !SERVER_ONLY.test(withoutComments(file.content)),
        'is a queries.ts without `import "server-only"`, so its reads can reach the browser bundle',
      );

    await expect(rule).toPassAsync();
  });

  it('has no mutations.ts that is not a server action module', async () => {
    const rule = projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo(
        (file) =>
          apiFilename(file.path) === 'mutations' &&
          !USE_SERVER.test(withoutComments(file.content)),
        'is a mutations.ts without `"use server"`, so the browser cannot call it',
      );

    await expect(rule).toPassAsync();
  });
});
