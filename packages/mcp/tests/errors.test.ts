import {
  NETWORK_ERROR_MESSAGE,
  type RustrakError,
  SERVER_ERROR_MESSAGE,
} from '@rustrak/client';
import { describe, expect, it } from 'vitest';
import { mcpDone, mcpJson, mcpRefusal, toMcpError } from '../src/errors.js';

describe('toMcpError', () => {
  it('renders not_found without doubling the prefix', () => {
    const error: RustrakError = {
      kind: 'not_found',
      status: 404,
      message: 'Resource not found: issue-123',
    };
    const result = toMcpError(error);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe('text');
    // Exactly once. A case-insensitive /not found/ match cannot tell
    // `Resource not found: X` from `Not found: Resource not found: X`,
    // which is how the doubled prefix survived here.
    expect(result.content[0]?.text?.match(/not found/gi)).toHaveLength(1);
    expect(result.content[0]?.text).toBe('Resource not found: issue-123');
  });

  it('does not include stack traces in error output', () => {
    const result = toMcpError({
      kind: 'not_found',
      status: 404,
      message: 'Resource not found: issue-123',
    });
    const text = result.content[0]?.text ?? '';
    expect(text).not.toMatch(/at Object\./);
    expect(text).not.toMatch(/\.ts:\d+/);
  });

  it('renders rate_limited with its retryAfter', () => {
    const result = toMcpError({
      kind: 'rate_limited',
      status: 429,
      message: 'Rate limit exceeded',
      retryAfter: 30,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/30/);
  });

  it('renders rate_limited without a retryAfter', () => {
    const result = toMcpError({
      kind: 'rate_limited',
      status: 429,
      message: 'Rate limit exceeded',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/rate limit/i);
    expect(result.content[0]?.text).toMatch(/\?s/);
  });

  it('points unauthenticated at the token env var', () => {
    const result = toMcpError({
      kind: 'unauthenticated',
      status: 401,
      message: 'Unauthorized',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/RUSTRAK_API_TOKEN/);
  });

  it('falls through to the default arm for validation', () => {
    const result = toMcpError({
      kind: 'validation',
      status: 400,
      message: 'Invalid input',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('API error: Invalid input');
  });

  it('renders a 5xx as the redacted message, never the server body', () => {
    const result = toMcpError({
      kind: 'server_error',
      status: 500,
      message: SERVER_ERROR_MESSAGE,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(SERVER_ERROR_MESSAGE);
  });

  it('renders a transport failure', () => {
    const result = toMcpError({
      kind: 'network',
      message: NETWORK_ERROR_MESSAGE,
      reason: 'unreachable',
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(NETWORK_ERROR_MESSAGE);
  });

  it('covers every kind of the closed union', () => {
    // The union is total, so `toMcpError` must never return an empty or
    // unlabelled body for any member. Enumerated by hand: adding a kind to
    // the client without a matching entry here is a compile error, not a
    // silently untested arm.
    const errors: RustrakError[] = [
      { kind: 'validation', status: 400, message: 'v' },
      { kind: 'unauthenticated', status: 401, message: 'u' },
      { kind: 'forbidden', status: 403, message: 'f' },
      { kind: 'not_found', status: 404, message: 'n' },
      { kind: 'conflict', status: 409, message: 'c' },
      { kind: 'gone', status: 410, message: 'g' },
      { kind: 'payload_too_large', status: 413, message: 'p' },
      { kind: 'rate_limited', status: 429, message: 'r' },
      { kind: 'client_error', status: 418, message: 'ce' },
      { kind: 'invalid_request', message: 'ir' },
      { kind: 'server_error', status: 500, message: SERVER_ERROR_MESSAGE },
      { kind: 'network', message: NETWORK_ERROR_MESSAGE, reason: 'timeout' },
      { kind: 'invalid_response', message: 'iresp' },
    ];

    for (const error of errors) {
      const result = toMcpError(error);
      expect(result.isError, error.kind).toBe(true);
      expect(result.content[0]?.type, error.kind).toBe('text');
      expect(result.content[0]?.text?.length, error.kind).toBeGreaterThan(0);
    }
  });
});

describe('mcpJson', () => {
  it('prints the data of a successful Result, not the Result', () => {
    const result = mcpJson({ success: true, data: { id: 7 } });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0]?.text ?? '')).toEqual({ id: 7 });
  });

  it('renders a failed Result as an error', () => {
    const result = mcpJson({
      success: false,
      error: { kind: 'forbidden', status: 403, message: 'Nope' },
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Nope');
  });
});

describe('mcpDone', () => {
  it('confirms only when the Result succeeded', () => {
    const result = mcpDone({ success: true, data: undefined }, 'Deleted.');
    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.text).toBe('Deleted.');
  });

  it('never reports success for a failed void call', () => {
    // The regression this helper exists to prevent: `Result<void>` failures
    // are values, so a tool that ignored one would say `deleted successfully`
    // after a 403.
    const result = mcpDone(
      {
        success: false,
        error: { kind: 'forbidden', status: 403, message: 'Not allowed' },
      },
      'Deleted.',
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).not.toContain('Deleted.');
    expect(result.content[0]?.text).toContain('Not allowed');
  });
});

describe('mcpRefusal', () => {
  it('reports a tool-side refusal without an API prefix', () => {
    const result = mcpRefusal('not confirmed');
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('not confirmed');
  });
});
