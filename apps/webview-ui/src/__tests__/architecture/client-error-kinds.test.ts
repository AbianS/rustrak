import type { RustrakErrorKind } from '@rustrak/client';
import { describe, expect, it } from 'vitest';

/**
 * AD-9 rule (9): the client's error `kind` values equal an explicit allowlist,
 * so a new variant fails in the release that introduces it rather than being
 * silently absorbed by a `default:` arm.
 *
 * AD-9 words this as "a runtime test". It is a **compile-time** check here, on
 * purpose, and the deviation is the stronger reading of the same intent:
 *
 * - `RustrakErrorKind` is `RustrakError['kind']`, a pure type. Nothing in
 *   `@rustrak/client` enumerates the kinds at runtime, so a runtime test would
 *   need a new export added to a published package for the sole benefit of a
 *   test in a different package.
 * - `satisfies Record<RustrakErrorKind, true>` fails in both directions: a kind
 *   added upstream leaves a missing key, and a kind removed upstream leaves an
 *   excess one. Neither compiles.
 * - A type error cannot be skipped. `it.skip` can.
 *
 * The runtime assertion below is the AD-9 population floor, not the rule. The
 * rule is the `satisfies` on the line above it, and it is enforced by
 * `check-types`, which `pnpm ci` runs.
 */
const KNOWN_KINDS = {
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
} satisfies Record<RustrakErrorKind, true>;

describe('AD-9 rule (9): the client error kind allowlist', () => {
  it('covers the population it expects to cover', () => {
    // 13 kinds at @rustrak/client 0.13.0. Changing this number is a deliberate
    // act taken in the same commit as the variant that moved it, and it is the
    // moment to ask whether every surface that branches on `kind` has copy for
    // the new one -- `error-copy.ts` will silently absorb it into `default:`.
    expect(Object.keys(KNOWN_KINDS)).toHaveLength(13);
  });
});
