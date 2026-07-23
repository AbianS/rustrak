import ky, { type HTTPError, isHTTPError, type KyInstance } from 'ky';
import type { ClientConfig } from '../config.js';
import {
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

  switch (status) {
    case 400:
      return { kind: 'validation', status, message };
    case 401:
      return { kind: 'unauthenticated', status, message };
    case 403:
      return { kind: 'forbidden', status, message };
    case 404:
      return { kind: 'not_found', status, message };
    case 409:
      return { kind: 'conflict', status, message };
    case 410:
      return { kind: 'gone', status, message };
    case 413:
      return { kind: 'payload_too_large', status, message };
    case 429: {
      const retryAfter = readRetryAfter(response);
      return retryAfter === undefined
        ? { kind: 'rate_limited', status, message }
        : { kind: 'rate_limited', status, message, retryAfter };
    }
    default:
      return { kind: 'client_error', status, message };
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
