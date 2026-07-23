import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  APP_ERROR_PREFIXES,
  APP_ERROR_STATUS,
  type AppErrorType,
} from '../mocks/handlers.js';

/**
 * The rest of this suite is a closed loop: every assertion restates the literal
 * the fixture on the previous screen sent, so a fixture and its assertion can
 * drift away from the server together and stay green forever.
 *
 * This file is the one place that reads the other side of the contract. It
 * parses `apps/server/src/error.rs` and asserts that the prefix and status
 * tables the fixtures are built from still match the Rust `enum`. Reword an
 * `#[error("...")]` or remap a `StatusCode` and this test fails, which is the
 * only mechanism that can catch that class of drift from TypeScript.
 *
 * Resolved from `import.meta.url`, so it does not depend on the cwd vitest ran
 * from.
 */
const ERROR_RS = fileURLToPath(
  new URL('../../../../apps/server/src/error.rs', import.meta.url),
);

const source = existsSync(ERROR_RS) ? readFileSync(ERROR_RS, 'utf8') : null;

if (source === null) {
  // `@rustrak/client` is publishable on its own, so a consumer may have the
  // package without the Rust workspace beside it. Skipping loudly beats failing
  // with an unexplained ENOENT.
  console.warn(
    `[app-error-contract] skipped: ${ERROR_RS} not found. ` +
      'The AppError coupling check only runs inside the Rustrak monorepo.',
  );
}

/** The `StatusCode` constants `AppError::status_code` can name. */
const STATUS_CODE_NUMBERS: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_SERVER_ERROR: 500,
};

/** `#[error("<display>")]` immediately above `VariantName(`. */
function parseDisplayStrings(rust: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /#\[error\("([^"]+)"\)\]\s*(\w+)\(/g;
  for (const m of rust.matchAll(re)) {
    const [, display, variant] = m;
    if (display !== undefined && variant !== undefined) {
      out.set(variant, display);
    }
  }
  return out;
}

/** `AppError::Variant(_) => "TypeLiteral",` inside `error_response`. */
function parseTypeLiterals(rust: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /AppError::(\w+)\(_\)\s*=>\s*"(\w+)"/g;
  for (const m of rust.matchAll(re)) {
    const [, variant, literal] = m;
    if (variant !== undefined && literal !== undefined) {
      out.set(variant, literal);
    }
  }
  return out;
}

/** `AppError::Variant(_) => StatusCode::NAME,` inside `status_code`. */
function parseStatusCodes(rust: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /AppError::(\w+)\(_\)\s*=>\s*StatusCode::(\w+)/g;
  for (const m of rust.matchAll(re)) {
    const [, variant, status] = m;
    if (variant !== undefined && status !== undefined) {
      out.set(variant, status);
    }
  }
  return out;
}

describe.skipIf(source === null)(
  'AppError contract (apps/server/src/error.rs)',
  () => {
    // Non-null inside the block: `describe.skipIf` guarantees it.
    const rust = source as string;

    const displays = parseDisplayStrings(rust);
    const literals = parseTypeLiterals(rust);
    const statuses = parseStatusCodes(rust);

    it('parses all eight variants out of the Rust enum', () => {
      // If the parse silently matches nothing, every table comparison below
      // would trivially pass, so assert the parse itself first.
      expect(displays.size).toBe(8);
      expect(literals.size).toBe(8);
      expect(statuses.size).toBe(8);
      expect([...literals.keys()].sort()).toEqual([...displays.keys()].sort());
      expect([...statuses.keys()].sort()).toEqual([...displays.keys()].sort());
    });

    it('every variant interpolates its detail as a trailing {0}', () => {
      for (const [variant, display] of displays) {
        expect(
          display.endsWith('{0}'),
          `${variant}'s #[error(...)] must end with {0}, got "${display}"`,
        ).toBe(true);
      }
    });

    it('APP_ERROR_PREFIXES matches the #[error(...)] Display prefixes', () => {
      const expected: Record<string, string> = {};
      for (const [variant, display] of displays) {
        const literal = literals.get(variant);
        if (literal === undefined) continue;
        expected[literal] = display.slice(0, -'{0}'.length);
      }

      expect(APP_ERROR_PREFIXES).toEqual(expected);
    });

    it('APP_ERROR_STATUS matches AppError::status_code', () => {
      const expected: Record<string, number> = {};
      for (const [variant, statusName] of statuses) {
        const literal = literals.get(variant);
        const code = STATUS_CODE_NUMBERS[statusName];
        expect(
          code,
          `unknown StatusCode::${statusName}; add it to STATUS_CODE_NUMBERS`,
        ).toBeDefined();
        if (literal !== undefined && code !== undefined) {
          expected[literal] = code;
        }
      }

      expect(APP_ERROR_STATUS).toEqual(expected);
    });

    it('the AppErrorType union covers exactly the literals Rust can emit', () => {
      const declared = Object.keys(APP_ERROR_PREFIXES) as AppErrorType[];
      expect(declared.sort()).toEqual([...literals.values()].sort());
    });
  },
);
