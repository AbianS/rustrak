import { describe, expect, it } from 'vitest';
import {
  read,
  rel,
  SRC,
  sourceFilesUnder,
  withoutComments,
} from './source-files';

/**
 * The rule this whole phase exists to buy: **the domain does not know Next.**
 *
 * `features/*​/model`, `features/*​/lib` and `shared/lib` hold the logic that is
 * expensive to rewrite and cheap to keep — status derivation, stack-trace
 * formatting, session-health thresholds, error copy. None of it should care
 * which framework renders it, and a migration off Next should leave all of it
 * untouched.
 *
 * Measured before this phase: 90 of 189 files already imported nothing from
 * `next/*`, and another 44 touched only `next/link` and `next/navigation`,
 * which any framework replaces with a shim. That 71% was an accident of how
 * the code happened to be written. This rule is what turns it into a property.
 *
 * Deliberately **not** applied to `ui` segments or to `app/`. Components use
 * `useRouter` and `Link`, and pages are the coupled edge by design — the spec
 * measured the alternative (moving reads to the browser) and rejected it,
 * because the server serves `allow_any_origin()` without credentials and the
 * session cookie would never arrive.
 */

const NEXT_IMPORT = /from\s+['"]next(\/|['"])/;

const CORE = [
  /(^|\/)features\/[^/]+\/model\//,
  /(^|\/)features\/[^/]+\/lib\//,
  /(^|\/)shared\/lib\//,
];

const core = sourceFilesUnder(SRC)
  .filter((f) => !f.includes('__tests__'))
  .filter((f) => CORE.some((p) => p.test(rel(f))));

describe('the portable core does not import Next', () => {
  it('reads the population it expects to read', () => {
    // 14 files after the phase-6 migration. If this ever collapses toward zero
    // the globs stopped matching and every file below passes for free, which is
    // the vacuous-rule failure AD-9 exists to prevent.
    expect(core.length).toBeGreaterThanOrEqual(14);
  });

  it('has no file importing from next/*', () => {
    const violations = core
      .filter((f) => NEXT_IMPORT.test(withoutComments(read(f))))
      .map(rel);

    expect(violations).toEqual([]);
  });
});
