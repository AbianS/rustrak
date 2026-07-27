import type { KyInstance, ResponsePromise } from 'ky';
import { describe, expect, it, vi } from 'vitest';
import type { RustrakError } from '../../src/errors.js';
import { NETWORK_ERROR_MESSAGE } from '../../src/errors.js';
import { readSetCookie } from '../../src/resources/auth.js';
import { BaseResource } from '../../src/resources/base.js';
import type { Result } from '../../src/result.js';
import { expectErr, expectOk } from '../helpers/result.js';

/**
 * The boundary decisions no MSW fixture can reach: what a *rejected* body read
 * means, what happens to a rejection that is not the internal carrier, whether
 * a body nobody reads is released, and the `Set-Cookie` fallback for a runtime
 * without `Headers.getSetCookie`.
 *
 * MSW hands back a well-formed `Response` on a runtime that has every modern
 * API, so the only way to drive `response.json()` into rejecting with a chosen
 * error, to observe that `body.cancel()` was called, or to remove
 * `getSetCookie`, is to build the `Response` here. Everything else about these
 * paths is covered against the real client in `tests/integration/`.
 */
class TestResource extends BaseResource {
  readJsonOf(response: Response): Promise<Result<unknown, RustrakError>> {
    return this.readJson(response);
  }

  /** Drive the boundary with a send that rejects with something of our choosing. */
  sendThatFails(error: unknown): Promise<Result<void, RustrakError>> {
    return this.requestVoid(
      () => Promise.reject(error) as unknown as ResponsePromise,
    );
  }

  voidCall(response: Response): Promise<Result<void, RustrakError>> {
    return this.requestVoid(
      () => Promise.resolve(response) as unknown as ResponsePromise,
    );
  }
}

const resource = new TestResource({} as KyInstance);

/** A `Response` whose body read rejects with exactly `error`. */
function responseThatFails(error: unknown): Response {
  const response = new Response(null, { status: 200 });
  vi.spyOn(response, 'json').mockRejectedValue(error);
  return response;
}

describe('body read failures', () => {
  it('reports invalid_response when the body is not JSON', async () => {
    const result = await resource.readJsonOf(
      responseThatFails(new SyntaxError('Unexpected token < in JSON at 0')),
    );

    expect(expectErr(result).kind).toBe('invalid_response');
  });

  // The defect this file exists for: a socket dying mid-body rejects with a
  // bare `TypeError: terminated` in undici. The old unqualified catch called it
  // `invalid_response`, which `isRetryable` says is permanent, so a caller gave
  // up for good on a transient fault and the UI blamed a schema drift that
  // never happened.
  it('reports network when the connection dies mid-body', async () => {
    const terminated = new TypeError('terminated');
    (terminated as { cause?: unknown }).cause = new Error('other side closed');

    const error = expectErr(
      await resource.readJsonOf(responseThatFails(terminated)),
    );

    expect(error.kind).toBe('network');
    expect(error).toMatchObject({ reason: 'unreachable' });
    // Redacted like every other network error: the underlying message and its
    // cause can name the host and port.
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
    expect(error.message).not.toContain('terminated');
    expect(error).not.toHaveProperty('cause');
  });

  it('reports network when the body read is aborted', async () => {
    const aborted = new Error('The operation was aborted');
    aborted.name = 'AbortError';

    expect(
      expectErr(await resource.readJsonOf(responseThatFails(aborted))).kind,
    ).toBe('network');
  });

  it('reports network with reason timeout when the body read times out', async () => {
    const timedOut = new Error('read timed out');
    timedOut.name = 'TimeoutError';

    expect(
      expectErr(await resource.readJsonOf(responseThatFails(timedOut))),
    ).toMatchObject({ kind: 'network', reason: 'timeout' });
  });

  // The other half of the same discrimination. A `TypeError` with no transport
  // signature is a bug in this client, and the boundary's design note promises
  // it crashes rather than being laundered into `{success: false}`.
  it('rethrows a TypeError that is a programming error', async () => {
    const bug = new TypeError('response.jsn is not a function');

    await expect(resource.readJsonOf(responseThatFails(bug))).rejects.toThrow(
      'response.jsn is not a function',
    );
  });

  it('rethrows a ReferenceError', async () => {
    await expect(
      resource.readJsonOf(
        responseThatFails(new ReferenceError('x is not defined')),
      ),
    ).rejects.toThrow(ReferenceError);
  });
});

describe('the boundary only converts its own carrier', () => {
  // The design note in `base.ts`: anything thrown that is not a
  // `RustrakTransportFailure` is a programming error and keeps propagating.
  it('rethrows a rejection that is not a transport failure', async () => {
    const bug = new TypeError('http.post is not a function');

    await expect(resource.sendThatFails(bug)).rejects.toThrow(
      'http.post is not a function',
    );
  });

  it('rethrows a thrown non-Error from the body read', async () => {
    await expect(
      resource.readJsonOf(responseThatFails('a string, from somewhere odd')),
    ).rejects.toBe('a string, from somewhere odd');
  });
});

// `Headers.getSetCookie` landed in Node 18.16, below the supported floor,
// but `engines` is advisory: npm does not enforce it unless the consumer opted
// in. These are the session-establishing calls, so on an older runtime the
// unguarded call threw a `TypeError` out of `login`, from a method whose whole
// contract is that it returns a `Result` rather than throwing.
describe('reading Set-Cookie', () => {
  it('uses getSetCookie when the runtime has it', () => {
    const response = new Response(null, {
      headers: { 'Set-Cookie': 'session=abc; HttpOnly' },
    });

    expect(readSetCookie(response)).toEqual(['session=abc; HttpOnly']);
  });

  it('falls back to the folded header when getSetCookie is missing', () => {
    const response = new Response(null, {
      headers: { 'Set-Cookie': 'session=abc; HttpOnly' },
    });
    Object.defineProperty(response.headers, 'getSetCookie', {
      value: undefined,
      configurable: true,
    });

    expect(readSetCookie(response)).toEqual(['session=abc; HttpOnly']);
  });

  it('returns an empty array when there is no Set-Cookie at all', () => {
    const response = new Response(null);
    Object.defineProperty(response.headers, 'getSetCookie', {
      value: undefined,
      configurable: true,
    });

    expect(readSetCookie(response)).toEqual([]);
  });
});

describe('void responses release their body', () => {
  it('cancels the body of a response with no contract', async () => {
    const response = new Response('{"ignored": true}', { status: 200 });
    const cancel = vi.spyOn(
      response.body as ReadableStream<Uint8Array>,
      'cancel',
    );

    expectOk(await resource.voidCall(response));

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('still succeeds when cancelling the body rejects', async () => {
    const response = new Response('{"ignored": true}', { status: 200 });
    vi.spyOn(
      response.body as ReadableStream<Uint8Array>,
      'cancel',
    ).mockRejectedValue(new Error('stream already errored'));

    const result = await resource.voidCall(response);

    expect(result.success).toBe(true);
  });

  it('tolerates a response with no body at all', async () => {
    const result = await resource.voidCall(new Response(null, { status: 204 }));

    expect(result.success).toBe(true);
  });
});
