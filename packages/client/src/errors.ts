/**
 * The one closed error union `@rustrak/client` reports.
 *
 * It mirrors `apps/server/src/error.rs` variant by variant, plus the three
 * failures that never reach the server (`invalid_request`, `network`,
 * `invalid_response`) and a catch-all so an unanticipated status is still
 * representable rather than unrepresentable.
 *
 * Every member is a plain object: no class, no prototype chain, no `Error`
 * instance. That is what lets a failed `Result` survive `structuredClone` and
 * therefore React's server/client boundary.
 *
 * `status` is `number`, never a literal union. Pinning literals would make a
 * proxy-generated 502 or a future status a type error at the call site rather
 * than a value the consumer can log.
 */
export type RustrakError =
  /** 400. `AppError::Validation`: the server rejected the request. */
  | {
      readonly kind: 'validation';
      readonly status: number;
      readonly message: string;
    }
  /** 401. `AppError::Unauthorized`: no session, or the session expired. */
  | {
      readonly kind: 'unauthenticated';
      readonly status: number;
      readonly message: string;
    }
  /** 403. `AppError::Forbidden`: authenticated, but not allowed. */
  | {
      readonly kind: 'forbidden';
      readonly status: number;
      readonly message: string;
    }
  /** 404. `AppError::NotFound`. */
  | {
      readonly kind: 'not_found';
      readonly status: number;
      readonly message: string;
    }
  /** 409. `AppError::Conflict`. */
  | {
      readonly kind: 'conflict';
      readonly status: number;
      readonly message: string;
    }
  /** 410. Reserved for endpoints that retire a resource rather than delete it. */
  | { readonly kind: 'gone'; readonly status: number; readonly message: string }
  /** 413. `AppError::PayloadTooLarge`: envelope ingestion only. */
  | {
      readonly kind: 'payload_too_large';
      readonly status: number;
      readonly message: string;
    }
  /** 429. The ingest rate limiter (`routes/ingest.rs`), the one flat body. */
  | {
      readonly kind: 'rate_limited';
      readonly status: number;
      readonly message: string;
      /** Seconds to wait, from the `Retry-After` header, when the server sent one. */
      readonly retryAfter?: number;
    }
  /**
   * Any status below 500 that no other member claims. The catch-all that keeps
   * the union closed but total.
   *
   * Not only 4xx: a 3xx that reached the error path (a redirect ky did not
   * follow), a 408, an unenumerated 4xx, and an opaque `status: 0` all land
   * here. `status` is the field to read; `kind` only says "no dedicated
   * handling exists for this one".
   */
  | {
      readonly kind: 'client_error';
      readonly status: number;
      readonly message: string;
    }
  /**
   * The caller's own input failed a pre-flight check. Never reached the
   * network, so it has no status.
   */
  | { readonly kind: 'invalid_request'; readonly message: string }
  /**
   * Any 5xx. `AppError::Database` and `AppError::Internal` both land here, and
   * so does anything a reverse proxy generates.
   *
   * `message` is always {@link SERVER_ERROR_MESSAGE}: the server's body is
   * discarded at construction, inside the client, so no consumer can leak a
   * connection string or a filesystem path into a UI. `incidentId` is the
   * forward-compatible slot for a correlation id the server does not send yet.
   */
  | {
      readonly kind: 'server_error';
      readonly status: number;
      readonly message: string;
      readonly incidentId?: string;
    }
  /**
   * The request never got an HTTP response: DNS, connection refused, TLS,
   * timeout, abort. Also a connection that died while the body was still being
   * read, which is a transport failure even though a status line arrived.
   *
   * `message` is always {@link NETWORK_ERROR_MESSAGE} or
   * {@link TIMEOUT_ERROR_MESSAGE}, never the underlying error's own: fetch
   * builds that message by interpolating the request method and URL
   * (`Request failed due to a network error: GET http://rustrak.internal:8080/api/projects`),
   * so echoing it prints a self-hosted deployment's internal host and port into
   * any UI that renders `error.message`.
   *
   * Carries no `cause` for the same reason. `reason` is the machine-readable
   * discriminator a caller needs instead, derived from the error's `name` and
   * never from its message.
   */
  | {
      readonly kind: 'network';
      readonly message: string;
      /** `timeout` when the client gave up waiting; `unreachable` otherwise. */
      readonly reason: 'timeout' | 'unreachable';
    }
  /**
   * A 2xx arrived but the body is not what the schema promises: not JSON, or
   * JSON of the wrong shape.
   *
   * Carries no Zod issues: they embed the offending response data.
   */
  | { readonly kind: 'invalid_response'; readonly message: string };

/** The `kind` discriminant, useful for exhaustive `switch` in consumers. */
export type RustrakErrorKind = RustrakError['kind'];

/**
 * The fixed message every `server_error` carries. Exported so a consumer (or a
 * test) can assert that nothing server-supplied survived the 5xx redaction.
 */
export const SERVER_ERROR_MESSAGE = 'The server failed to handle the request.';

/**
 * The fixed message a `network` error carries when the request never reached
 * the server. Fixed for the same reason as {@link SERVER_ERROR_MESSAGE}: the
 * underlying message interpolates the request URL, which is the deployment's
 * internal host and port. Read `reason` to branch, not `message`.
 */
export const NETWORK_ERROR_MESSAGE = 'The request could not reach the server.';

/** The fixed message a `network` error carries when the client timed out. */
export const TIMEOUT_ERROR_MESSAGE = 'The request timed out.';

/**
 * Whether retrying the same call could plausibly succeed.
 *
 * `network` and `server_error` are transient by nature; `rate_limited` clears
 * once its window rolls over. Everything else is deterministic: the same
 * request will fail the same way.
 */
export function isRetryable(error: RustrakError): boolean {
  return (
    error.kind === 'network' ||
    error.kind === 'server_error' ||
    error.kind === 'rate_limited'
  );
}
