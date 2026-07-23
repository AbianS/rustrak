import type { KyInstance, ResponsePromise } from 'ky';
import type { ZodSchema } from 'zod';
import { NETWORK_ERROR_MESSAGE, type RustrakError } from '../errors.js';
import { Err, Ok, type Result } from '../result.js';
import { isTransportFailure } from '../utils/http.js';

/**
 * A `TypeError` message that names a dead connection rather than a bad call.
 *
 * undici reports a socket that died mid-body as a bare `TypeError: terminated`,
 * indistinguishable by type from `x is not a function`. Node sets `cause` on
 * the transport one; this pattern covers the runtimes that do not.
 */
const TRANSPORT_TYPE_ERROR =
  /terminated|aborted|socket|network|closed|reset|fetch failed/i;

/**
 * Whether a rejected body read is provably a bug in this client rather than a
 * connection that went away.
 *
 * The default is deliberately the other way round from the old bare `catch`:
 * only what is provably a programming error is rethrown, because reading the
 * body is a second trip over the socket and can fail for a transport reason
 * long after the status line arrived.
 */
function isProgrammingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    // Nothing in a body read throws a non-`Error`. Whatever produced it is not
    // a transport fault, so let it crash where it can be debugged.
    return true;
  }

  if (error instanceof ReferenceError || error instanceof RangeError) {
    return true;
  }

  if (error instanceof TypeError) {
    return (
      error.cause === undefined && !TRANSPORT_TYPE_ERROR.test(error.message)
    );
  }

  return false;
}

/**
 * Decide what a rejected body read means.
 *
 * The three outcomes are deliberately distinct, and the old unqualified
 * `catch` collapsed them into one:
 *
 * - `SyntaxError` is the only proof the bytes arrived and were not JSON. That
 *   is `invalid_response`, and `isRetryable` correctly says do not retry.
 * - A connection that died mid-body rejects with `TypeError: terminated`
 *   (undici), an `AbortError`, or a plain `Error` from an interceptor. Calling
 *   any of those `invalid_response` told the caller a transient fault was
 *   permanent and blamed a schema drift that never happened, so they map to
 *   `network`.
 * - A genuine `TypeError` from a bug is rethrown, which is what the boundary's
 *   own design note promises: a programming error crashes rather than being
 *   laundered into `{success: false}`.
 */
function classifyBodyFailure(error: unknown): RustrakError | 'rethrow' {
  if (error instanceof SyntaxError) {
    return {
      kind: 'invalid_response',
      message: 'The server returned a body that is not valid JSON.',
    };
  }

  if (isProgrammingError(error)) {
    return 'rethrow';
  }

  // Same redaction as `utils/http.ts`: the underlying message can name the
  // resolved host and port. `reason` is the field to branch on.
  return {
    kind: 'network',
    message: NETWORK_ERROR_MESSAGE,
    reason:
      error instanceof Error && error.name === 'TimeoutError'
        ? 'timeout'
        : 'unreachable',
  };
}

/**
 * Release the socket for a response nobody will read.
 *
 * In Node an unconsumed body pins its connection out of the keep-alive pool
 * until GC, which every `delete`/`update` method and `auth.logout` would
 * otherwise do on each call. Cancelling can itself reject (the stream may
 * already be errored), and that must never become the call's result.
 */
export function discardBody(response: Response): void {
  try {
    void response.body?.cancel().catch(() => {});
  } catch {
    // A body that cannot even be cancelled is already gone. Nothing to release.
  }
}

/**
 * Base resource: the single place where a rejected ky promise becomes an `Err`.
 *
 * Every public method funnels through {@link BaseResource.requestResponse}
 * (directly or via {@link BaseResource.request} / {@link
 * BaseResource.requestVoid}) instead of carrying its own try/catch. One
 * boundary for 86 methods means the "what counts as an expected failure"
 * decision is made once, and it is auditable: only a
 * `RustrakTransportFailure`, the carrier `src/utils/http.ts` throws from ky's
 * `beforeError` hook, is converted. A `TypeError` from a genuine bug is
 * rethrown untouched, so a programming error still surfaces as a crash rather
 * than being laundered into `{success: false}`.
 *
 * Reading the body is a second failure point with the same rule: see
 * {@link classifyBodyFailure}, which separates "not JSON" from "the connection
 * died" from "this is a bug".
 */
export abstract class BaseResource {
  protected readonly http: KyInstance;

  constructor(http: KyInstance) {
    this.http = http;
  }

  /**
   * Validate an API response against its Zod schema.
   *
   * Failure is `invalid_response`: "our own response schema did not match",
   * never "the user's input was rejected". No Zod issues are attached: they
   * embed the offending response data.
   */
  protected validate<T>(
    data: unknown,
    schema: ZodSchema<T>,
  ): Result<T, RustrakError> {
    const result = schema.safeParse(data);

    if (!result.success) {
      return Err({
        kind: 'invalid_response',
        message: 'The server response did not match the expected schema.',
      });
    }

    return Ok(result.data);
  }

  /**
   * Validate caller-supplied input before it reaches the network.
   *
   * Failure is `invalid_request` and has no `status`: nothing was sent.
   */
  protected validateInput<T>(
    input: unknown,
    schema: ZodSchema<T>,
  ): Result<T, RustrakError> {
    const result = schema.safeParse(input);

    if (!result.success) {
      return Err({
        kind: 'invalid_request',
        message: 'The request input did not match the expected schema.',
      });
    }

    return Ok(result.data);
  }

  /**
   * The boundary. Runs `send`, converts a transport failure into an `Err`, and
   * hands the `Response` to `read`.
   *
   * Anything thrown that is not the internal carrier is a programming error and
   * is rethrown.
   */
  protected async requestResponse<T>(
    send: () => ResponsePromise,
    read: (response: Response) => Promise<Result<T, RustrakError>>,
  ): Promise<Result<T, RustrakError>> {
    let response: Response;

    try {
      response = await send();
    } catch (error) {
      if (isTransportFailure(error)) {
        return Err(error.rustrakError);
      }
      throw error;
    }

    return read(response);
  }

  /**
   * Read a JSON body, mapping a failed read onto the right `kind`.
   *
   * Shared with `AuthResource`, which needs the `Set-Cookie` headers off the
   * raw `Response` and so cannot go through {@link BaseResource.request}.
   */
  protected async readJson(
    response: Response,
  ): Promise<Result<unknown, RustrakError>> {
    try {
      return Ok(await response.json());
    } catch (error) {
      const failure = classifyBodyFailure(error);
      if (failure === 'rethrow') {
        throw error;
      }
      return Err(failure);
    }
  }

  /** Send a request and validate its JSON body against `schema`. */
  protected async request<T>(
    send: () => ResponsePromise,
    schema: ZodSchema<T>,
  ): Promise<Result<T, RustrakError>> {
    return this.requestResponse(send, async (response) => {
      const body = await this.readJson(response);
      if (!body.success) {
        return body;
      }

      return this.validate(body.data, schema);
    });
  }

  /** Send a request whose response body carries no contract (204, or ignored). */
  protected async requestVoid(
    send: () => ResponsePromise,
  ): Promise<Result<void, RustrakError>> {
    return this.requestResponse(send, async (response) => {
      discardBody(response);
      return Ok(undefined);
    });
  }
}
