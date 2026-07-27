import { describe, expect, it } from 'vitest';
import {
  isRetryable,
  NETWORK_ERROR_MESSAGE,
  type RustrakError,
  type RustrakErrorKind,
  SERVER_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
} from '../../src/errors.js';
import {
  Err,
  mapResult,
  Ok,
  type Result,
  unwrap,
  unwrapOr,
} from '../../src/result.js';

/**
 * What is left here after the union replaced the nine error classes: the two
 * facts about `src/errors.ts` that can be established without a request.
 *
 * - `isRetryable` is a total function over the union, exercised per member.
 * - The fixed messages are fixed, and are what redaction substitutes.
 *
 * Everything else the predecessor of this file asserted, that `status` is
 * present on the network-derived members and absent on the other three, that
 * `network` carries no `cause`, that `invalid_response` carries no Zod issues,
 * that narrowing on `kind` reaches the member-specific fields, that an error is
 * a plain object that survives `structuredClone`, was asserted against object
 * literals written three lines above the assertion. Those tests could not fail:
 * no change in `src/` could break them, because no `src/` code ran. They are
 * covered for real in `tests/integration/error-handling.test.ts`, which drives
 * the client against MSW and asserts the same facts on the errors it actually
 * produces, so they were deleted here rather than duplicated.
 */
describe('RustrakError union', () => {
  /**
   * The inventory of every `kind`, and the one place a new union member has to
   * be registered.
   *
   * `satisfies Record<RustrakErrorKind, true>` is what makes that true: drop a
   * member and the object is missing a key, add one to `src/errors.ts` and it
   * has an extra. The predecessor of this constant was a
   * `RustrakErrorKind[]` array with a comment claiming the same guarantee,
   * which was false: an array literal is not exhaustiveness-checked, so an
   * array of one member type-checked clean.
   *
   * `check-types` still excludes `tests/` (see the deferred-work entry on the
   * unenforced test tsconfig), so today that check runs in the editor rather
   * than in CI. The runtime half below is what holds the line in the meantime:
   * every key here is fed through the real `isRetryable`, so a member added to
   * the inventory without a retry decision fails the suite.
   */
  const KIND_INVENTORY = {
    validation: true,
    unauthenticated: true,
    forbidden: true,
    not_found: true,
    conflict: true,
    gone: true,
    payload_too_large: true,
    rate_limited: true,
    client_error: true,
    invalid_request: true,
    server_error: true,
    network: true,
    invalid_response: true,
  } as const satisfies Record<RustrakErrorKind, true>;

  /** The three transient kinds. Everything else is deterministic. */
  const RETRYABLE: readonly RustrakErrorKind[] = [
    'network',
    'server_error',
    'rate_limited',
  ];

  /** A representative value of each kind, for feeding to `isRetryable`. */
  function sample(kind: RustrakErrorKind): RustrakError {
    switch (kind) {
      case 'invalid_request':
      case 'invalid_response':
        return { kind, message: 'x' };
      case 'network':
        return { kind, message: NETWORK_ERROR_MESSAGE, reason: 'unreachable' };
      case 'server_error':
        return { kind, status: 500, message: SERVER_ERROR_MESSAGE };
      default:
        return { kind, status: 400, message: 'x' };
    }
  }

  describe('isRetryable', () => {
    // One assertion per union member, driven off the inventory rather than a
    // hand-maintained list, so a new kind cannot be added without landing on
    // one side or the other of this line.
    it('classifies every kind in the union', () => {
      const kinds = Object.keys(KIND_INVENTORY) as RustrakErrorKind[];

      expect(kinds).toHaveLength(13);

      for (const kind of kinds) {
        expect(isRetryable(sample(kind)), `isRetryable(${kind})`).toBe(
          RETRYABLE.includes(kind),
        );
      }
    });
  });

  // The three fixed messages are production values, so asserting on them is
  // asserting on `src/errors.ts`. What matters is that none of them is a
  // template: the whole reason they exist is that the message they replaced
  // interpolated a connection string, a filesystem path, or the request URL.
  describe('fixed messages', () => {
    it('carry no interpolation and nothing environment-specific', () => {
      const fixed = [
        SERVER_ERROR_MESSAGE,
        NETWORK_ERROR_MESSAGE,
        TIMEOUT_ERROR_MESSAGE,
      ];

      for (const message of fixed) {
        expect(message).not.toContain('{');
        expect(message).not.toContain('$');
        expect(message).not.toContain('://');
        expect(message).not.toMatch(/:\d+/);
      }
    });

    it('are three distinct strings, so a consumer can tell them apart', () => {
      expect(
        new Set([
          SERVER_ERROR_MESSAGE,
          NETWORK_ERROR_MESSAGE,
          TIMEOUT_ERROR_MESSAGE,
        ]).size,
      ).toBe(3);
    });
  });
});

describe('Result', () => {
  it('Ok carries the value under `data` with `success: true`', () => {
    const result = Ok(42);

    expect(result).toEqual({ success: true, data: 42 });
    expect(result.success).toBe(true);
  });

  it('Err carries the error under `error` with `success: false`', () => {
    const error: RustrakError = {
      kind: 'network',
      message: 'down',
      reason: 'unreachable',
    };
    const result = Err(error);

    expect(result).toEqual({ success: false, error });
    expect(result.success).toBe(false);
  });

  it('Ok(undefined) is how a void call reports success', () => {
    const result: Result<void, RustrakError> = Ok(undefined);

    expect(result.success).toBe(true);
    expect(result).toHaveProperty('data');
  });

  it('a whole Result survives structuredClone, both arms', () => {
    const ok = Ok({ id: 1, nested: { list: [1, 2, 3] } });
    const err = Err<RustrakError>({
      kind: 'conflict',
      status: 409,
      message: 'Conflict: Cannot demote the last admin',
    });

    expect(structuredClone(ok)).toEqual(ok);
    expect(structuredClone(err)).toEqual(err);
    expect(Object.getPrototypeOf(ok)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(err)).toBe(Object.prototype);
  });

  describe('helpers', () => {
    it('unwrap returns the value of a success', () => {
      expect(unwrap(Ok('value'))).toBe('value');
    });

    // `unwrap` is the one place a caller opts back into exceptions, so it must
    // still throw, and the message must name the failure it was handed.
    it('unwrap throws on a failure, naming the error', () => {
      const result = Err<RustrakError>({
        kind: 'not_found',
        status: 404,
        message: 'Resource not found: Project 42',
      });

      expect(() => unwrap(result)).toThrow(
        'unwrap() called on a failed Result: Resource not found: Project 42',
      );
    });

    it('unwrapOr substitutes the fallback only on failure', () => {
      expect(unwrapOr(Ok(1), 99)).toBe(1);
      expect(
        unwrapOr(
          Err<RustrakError>({
            kind: 'network',
            message: 'x',
            reason: 'unreachable',
          }),
          99,
        ),
      ).toBe(99);
    });

    it('mapResult transforms a success and passes a failure through untouched', () => {
      const mapped = mapResult(Ok(2), (n) => n * 3);
      expect(mapped).toEqual({ success: true, data: 6 });

      const error: RustrakError = {
        kind: 'network',
        message: 'x',
        reason: 'unreachable',
      };
      const failure = mapResult(Err(error), () => {
        throw new Error('must not run');
      });
      expect(failure).toEqual({ success: false, error });
    });
  });
});
