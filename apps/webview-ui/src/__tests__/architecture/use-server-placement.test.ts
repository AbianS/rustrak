import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';
import {
  isTestFile,
  read,
  SRC,
  sourceFilesUnder,
  withoutComments,
} from './source-files';

/**
 * AD-9 rule (10): no `'use server'` directive exists anywhere outside
 * `features/*​/actions.ts`.
 *
 * The directive is what turns a module's exports into public POST endpoints.
 * Keeping it to one filename per feature is what makes "which of our functions
 * are reachable from the internet" answerable by listing files rather than by
 * grepping and hoping.
 *
 * Written on archunit, which AD-9 names as the declared mechanism. The rule is
 * a per-file content predicate, which is exactly what `adhereTo` is for.
 *
 * This fails against the whole of `src/actions/` today, and that is its purpose
 * here: the failure list is the worklist for the redistribution.
 */

const USE_SERVER = /^\s*(['"])use server\1/m;

/**
 * The directive belongs to a slice's `api` segment.
 *
 * It used to be `features/<slice>/actions.ts`, from the flat split this phase
 * replaced. That split divided code by coupling to Next rather than by domain,
 * so the filename carried the architecture. Now the *segment* carries it and
 * the filename is free to say what the functions do -- `mutations.ts`,
 * `queries.ts` -- which is the point of segments.
 */
const isApiSegment = (path: string) =>
  /(^|\/)features\/[^/]+\/api\/[^/]+\.ts$/.test(path.split('\\').join('/'));

describe('AD-9 rule (10): where `use server` may appear', () => {
  // archunit reports an `EmptyTestViolation` when its filters match nothing,
  // but it does not expose *how many* it matched. AD-9 requires a floor that is
  // a specific number, on every rule whatever the mechanism, so the population
  // is asserted separately rather than delegated to the library.
  it('reads the population it expects to read', () => {
    const withDirective = sourceFilesUnder(SRC)
      .filter((f) => !f.includes('__tests__'))
      .filter((f) => USE_SERVER.test(withoutComments(read(f))));

    // 6 after phase 6: the `mutations.ts` of issue, token, alert, user and
    // project, plus storage. Nine slices have no mutations at all -- nothing
    // in the product writes an agent trace or a log -- and that is the shape,
    // not a gap.
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
          !isApiSegment(file.path),
        'declares `use server` outside features/*/api/',
      );

    await expect(rule).toPassAsync();
  });
});
