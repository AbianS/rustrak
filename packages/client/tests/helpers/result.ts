import { expect } from 'vitest';
import type { RustrakError } from '../../src/errors.js';
import type { Result } from '../../src/result.js';

/**
 * Assert a call succeeded and return its value.
 *
 * The `expect` inside is what makes the assertion real: without it a converted
 * test could read `result.data` off a failed `Result`, get `undefined`, and
 * still look like it was checking something. On failure the message carries the
 * `kind` and message the client actually produced, so a broken fixture is
 * diagnosable from the vitest output alone.
 */
export function expectOk<T>(result: Result<T, RustrakError>): T {
  if (!result.success) {
    expect.fail(
      `expected success, got ${result.error.kind}: ${result.error.message}`,
    );
  }
  return result.data;
}

/**
 * Assert a call failed and return the error, so the caller can pin its `kind`
 * (and its message where the old test pinned one).
 *
 * Calling this is the `success === false` half of the assertion; every call
 * site must still pin `kind`, because "it failed somehow" is strictly weaker
 * than the `instanceof` check it replaces.
 */
export function expectErr<T>(result: Result<T, RustrakError>): RustrakError {
  if (result.success) {
    expect.fail(
      `expected failure, got success: ${JSON.stringify(result.data)?.slice(0, 200)}`,
    );
  }
  return result.error;
}
