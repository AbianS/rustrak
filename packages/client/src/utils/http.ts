import ky, { type HTTPError, isHTTPError, type KyInstance } from 'ky';
import type { ClientConfig } from '../config.js';
import {
  FIELD_ERROR_CODES,
  type FieldError,
  type FieldErrorCode,
  NETWORK_ERROR_MESSAGE,
  type RustrakError,
  SERVER_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
} from '../errors.js';

/**
 * Internal carrier for a `RustrakError` travelling out of ky.
 *
 * ky signals a non-2xx by rejecting, and a rejection must be caught somewhere.
 * `RustrakError` is a plain object by design and throwing a non-`Error` would
 * be indistinguishable from a bug, so the union is smuggled out inside a real
 * `Error` subclass that `BaseResource` unwraps into an `Err`.
 *
 * Never exported from `src/index.ts`: it exists only between `beforeError` and
 * `BaseResource`. Anything that is *not* one of these is a genuine programming
 * error and keeps propagating.
 */
export class RustrakTransportFailure extends Error {
  public readonly rustrakError: RustrakError;

  constructor(error: RustrakError) {
    super(error.message);
    this.name = 'RustrakTransportFailure';
    this.rustrakError = error;
  }
}

/** Narrow a caught value to the internal carrier. */
export function isTransportFailure(
  value: unknown,
): value is RustrakTransportFailure {
  return value instanceof RustrakTransportFailure;
}

/**
 * Read the human-readable message out of an error body.
 *
 * Two shapes are live: every `AppError` sends `{error: {type, message}}` while
 * the ingest rate limiter sends a flat `{error: "..."}`. Reading only the flat
 * one turned every structured error into "[object Object]". See #204.
 */
function readErrorMessage(error: HTTPError, status: number): string {
  const fallback = `HTTP ${status} error`;

  // `typeof body === 'object'` on purpose: ky puts a non-JSON body in
  // `error.data` as a plain string, and property access on a string primitive
  // yields undefined, so a bare `if (body)` fell through to the generic message
  // only by accident. Make the fallback deliberate.
  const body = error.data as {
    error?: string | { type?: string; message?: string };
    message?: string;
  } | null;

  if (body && typeof body === 'object') {
    const nested =
      typeof body.error === 'object' ? body.error?.message : body.error;
    return nested || body.message || fallback;
  }

  return fallback;
}

const KNOWN_FIELD_ERROR_CODES = new Set<string>(FIELD_ERROR_CODES);

function isFieldErrorCode(value: unknown): value is FieldErrorCode {
  return typeof value === 'string' && KNOWN_FIELD_ERROR_CODES.has(value);
}

/**
 * Codes already reported by {@link warnUnknownFieldErrorCode}.
 *
 * Module-scoped so a list page rendering fifty rows against a newer server
 * logs once per unknown code rather than once per row. Version skew does not
 * change within a process, so once is the whole signal.
 */
const warnedFieldErrorCodes = new Set<string>();

/**
 * Make an unrecognised `code` visible without admitting it into the union.
 *
 * Dropping the entry is correct (see {@link readFieldErrors}), but a silent
 * drop is indistinguishable from "the server named no field": a client one
 * release behind a server that added a code loses every inline form error
 * site-wide with nothing anywhere to explain it.
 *
 * `console.warn` is the least intrusive mechanism that a support engineer can
 * actually act on. It needs no change to the public type, so no consumer has
 * to opt in to see it; it lands in the browser devtools console in a client
 * component and on stdout of the Node process (and therefore in whatever log
 * aggregation already exists) in a Server Component. The alternatives were
 * worse: throwing turns a cosmetic degradation into an outage, admitting the
 * code breaks the closed union this drop exists to protect, and a new
 * `fieldsDropped` flag on the union is invisible until somebody thinks to read
 * it, which is the same silence in a new place.
 */
function warnUnknownFieldErrorCode(code: string, field: string): void {
  if (warnedFieldErrorCodes.has(code)) return;
  warnedFieldErrorCodes.add(code);

  console.warn(
    `[@rustrak/client] Dropped a field error with an unrecognised code ` +
      `"${code}" (field "${field}"). This client build does not know that ` +
      `code, so the affected inputs degrade to a form-level error. The ` +
      `server is most likely newer than @rustrak/client; upgrade the client ` +
      `to match the server version.`,
  );
}

/**
 * Read `error.fields` out of an `AppError` body.
 *
 * Returns `undefined` rather than `[]` when there is nothing usable, so the
 * key stays absent on the `RustrakError` and a consumer can test for it.
 *
 * Entries are validated one by one and a malformed or unrecognised one is
 * dropped, never coerced. `FieldErrorCode` is a closed union: admitting a code
 * this build has never heard of would hand a consumer a value its own
 * exhaustive `switch` cannot see. A newer server adding a code therefore
 * degrades to a form-level error here, which is the same place an older client
 * already lands, and is announced once via
 * {@link warnUnknownFieldErrorCode} so the skew is not silent.
 *
 * `message` survives only alongside `code: 'custom'`. The server enforces the
 * same rule at construction, but the docs on both sides tell consumers to
 * select translated copy from `(field, code)` for every other code, so a
 * `message` that reaches them there is untranslatable English a careless
 * consumer would render. Dropping it here makes the rule true of the value, not
 * only of its producer.
 */
function readFieldErrors(error: HTTPError): FieldError[] | undefined {
  const body = error.data as { error?: { fields?: unknown } } | null;
  const raw = body && typeof body === 'object' ? body.error?.fields : undefined;

  if (!Array.isArray(raw)) {
    return undefined;
  }

  const fields: FieldError[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;

    const { field, code, message } = entry as Record<string, unknown>;
    if (typeof field !== 'string') continue;
    if (!isFieldErrorCode(code)) {
      if (typeof code === 'string') warnUnknownFieldErrorCode(code, field);
      continue;
    }

    fields.push(
      code === 'custom' && typeof message === 'string'
        ? { field, code, message }
        : { field, code },
    );
  }

  return fields.length > 0 ? fields : undefined;
}

/**
 * `Retry-After` in seconds, when the server sent a parseable one.
 *
 * RFC 9110 §10.2.3 allows two forms and a proxy in front of the Rust process
 * may send either. `Number.parseInt` read only the first, and read it too
 * loosely: it dropped the HTTP-date form entirely as `NaN`, and it returned
 * `-5` from `-5` and `3` from `3abc`, both of which a consumer would pass
 * straight to `setTimeout`.
 *
 * A date already in the past yields `0`, meaning "retry now", which is the
 * literal reading of the header.
 */
function readRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('Retry-After')?.trim();
  if (!header) {
    return undefined;
  }

  // delta-seconds: digits only. No sign, no trailing junk.
  if (/^\d+$/.test(header)) {
    return Number.parseInt(header, 10);
  }

  // A signed number is neither a valid delta-seconds nor an HTTP-date, and it
  // must not reach `Date.parse`: V8 reads `-5` as a year and would turn a
  // nonsense header into "retry now".
  if (/^[+-]\d+$/.test(header)) {
    return undefined;
  }

  const date = Date.parse(header);
  if (Number.isNaN(date)) {
    return undefined;
  }

  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/**
 * Attach `fields` to an error, or leave the key off entirely.
 *
 * The key is omitted rather than set to `undefined` so `'fields' in error`
 * stays an honest test and the object round-trips through `structuredClone`
 * with the same shape it was built with.
 */
function annotate<E extends RustrakError & { fields?: readonly FieldError[] }>(
  base: E,
  fields: readonly FieldError[] | undefined,
): E {
  return fields === undefined ? base : { ...base, fields };
}

/**
 * Map an HTTP status onto a `RustrakError` kind.
 *
 * Total by construction: every 5xx redacts, every other unanticipated status
 * lands on `client_error`, so no status is unrepresentable.
 */
export function transformHttpError(error: HTTPError): RustrakError {
  const { response } = error;
  const status = response.status;

  // 5xx never carries a server-supplied message. `AppError::Internal` and
  // `AppError::Database` interpolate arbitrary internal text (a pool error, an
  // OS errno, a filesystem path), and every consumer of this client renders
  // `error.message` somewhere. Discard it here, once, rather than trusting 128
  // call sites to remember.
  if (status >= 500) {
    return { kind: 'server_error', status, message: SERVER_ERROR_MESSAGE };
  }

  const message = readErrorMessage(error, status);

  // Read once, for every non-5xx status. `AppError::with_field` works on all
  // eight Rust variants, so restricting this to 400 and 409 meant an
  // annotation added to, say, the `Forbidden` in `routes/team.rs` would be
  // serialised, documented in `openapi.json`, and invisible to every consumer
  // with no test failing anywhere. It costs nothing when the key is absent:
  // `readFieldErrors` returns `undefined` without allocating.
  const fields = readFieldErrors(error);

  switch (status) {
    case 400:
      // The key is omitted rather than set to `undefined` so that
      // `'fields' in error` stays an honest test, matching `retryAfter` below.
      return annotate({ kind: 'validation', status, message }, fields);
    case 401:
      return annotate({ kind: 'unauthenticated', status, message }, fields);
    case 403:
      return annotate({ kind: 'forbidden', status, message }, fields);
    case 404:
      return annotate({ kind: 'not_found', status, message }, fields);
    case 409:
      return annotate({ kind: 'conflict', status, message }, fields);
    case 410:
      return annotate({ kind: 'gone', status, message }, fields);
    case 413:
      return annotate({ kind: 'payload_too_large', status, message }, fields);
    case 429: {
      const retryAfter = readRetryAfter(response);
      return annotate(
        retryAfter === undefined
          ? { kind: 'rate_limited', status, message }
          : { kind: 'rate_limited', status, message, retryAfter },
        fields,
      );
    }
    default:
      return annotate({ kind: 'client_error', status, message }, fields);
  }
}

export function createKyInstance(config: ClientConfig): KyInstance {
  const headers: Record<string, string> = {
    // `Accept` is set here rather than relied on from ky. The `.json()`
    // shortcut sets it before the request is issued, and `BaseResource` no
    // longer uses that shortcut: it awaits the `Response` and parses the body
    // itself, so without this every one of the 86 methods would send `*/*` and
    // any content-negotiating hop could answer with HTML.
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...config.headers,
  };

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  return ky.create({
    prefix: config.baseUrl,
    timeout: config.timeout ?? 30000,
    credentials: 'include',
    retry: {
      limit: config.maxRetries ?? 2,
      statusCodes: [408, 500, 502, 503, 504],
      methods: ['get', 'post', 'put', 'patch', 'delete'],
    },
    headers,
    hooks: {
      beforeError: [
        ({ error }) => {
          if (error.name === 'TimeoutError') {
            // No `cause`: the underlying error embeds the resolved host and
            // port, which must not ride along into a serialized payload.
            throw new RustrakTransportFailure({
              kind: 'network',
              message: TIMEOUT_ERROR_MESSAGE,
              reason: 'timeout',
            });
          }

          if (isHTTPError(error)) {
            throw new RustrakTransportFailure(transformHttpError(error));
          }

          // Neither is `error.message` usable here, for the same reason the
          // timeout branch above discards it: ky's `NetworkError` builds it as
          // `Request failed due to a network error: ${method} ${url}`, so
          // forwarding it publishes the deployment's internal host and port to
          // every consumer that renders `error.message`. `reason` comes from
          // `error.name`, which carries no request data.
          throw new RustrakTransportFailure({
            kind: 'network',
            message: NETWORK_ERROR_MESSAGE,
            reason: 'unreachable',
          });
        },
      ],
    },
  });
}
