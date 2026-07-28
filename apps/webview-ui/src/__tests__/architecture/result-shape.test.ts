import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';
import {
  isTestFile,
  SRC,
  sourceFilesUnder,
  withoutComments,
} from './source-files';

/**
 * AD-9 rule (7): no `success: false` object literal exists outside
 * `@rustrak/client`.
 *
 * This retires the six-different-error-shapes problem: before the `Result`
 * conversion, six actions each invented their own `{ ok, error }` variant and
 * no caller could tell which one it was holding.
 *
 * The rule is absolute, and the one place it collided was fixed by deleting the
 * collision rather than exempting it. `actions/auth.ts` used to mint
 * `{ success: false, error: 'invalid_credentials' }` for login, on the argument
 * that login collapses several client `kind`s into one answer to avoid an
 * account-existence oracle.
 *
 * That argument does not survive reading the server: it already answers the
 * same `Unauthorized` for an unknown email, a wrong password and a disabled
 * account, so the client reports a single `unauthenticated` and there is
 * nothing left for the action to collapse. The union was a translation layer
 * that `loginFailureMessage` then translated back. `login`, `getInvitation` and
 * `acceptInvitation` now return the client's `Result` like the other 74
 * exports, and the form decides that `unauthenticated` deserves one vague
 * sentence — a presentation decision, made where the presentation lives.
 *
 * Reading `result.success` is untouched by this rule. Consuming a `Result` is
 * the point; minting a second thing that looks like one is not.
 */

// `success` followed by `false`, which is the literal. A property *read*
// (`if (!result.success)`) has no colon and is not matched.
const FALSE_LITERAL = /\bsuccess\s*:\s*false\b/;

describe('AD-9 rule (7): only the client mints a failed Result', () => {
  it('reads the population it expects to read', () => {
    const files = sourceFilesUnder(SRC).filter((f) => !f.includes('__tests__'));

    // 180 source files at 81f50af. This floor exists because the rule is a
    // negative one: if the folder glob ever stops matching, every file passes
    // and the rule reports success while checking nothing.
    expect(files.length).toBeGreaterThanOrEqual(180);
  });

  it('has no `success: false` literal outside @rustrak/client', async () => {
    const rule = projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo(
        (file) =>
          !isTestFile(file.path) &&
          FALSE_LITERAL.test(withoutComments(file.content)),
        'mints a failed Result shape of its own; discriminate on a domain field instead',
      );

    await expect(rule).toPassAsync();
  });
});
