import {
  AuthenticationError,
  BadRequestError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
} from '@rustrak/client';
import { describe, expect, it } from 'vitest';
import { toMcpError } from '../src/errors.js';

describe('toMcpError', () => {
  it('returns isError: true for NotFoundError', () => {
    const err = new NotFoundError('Resource not found: issue-123');
    const result = toMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.type).toBe('text');
    // Exactly once. A case-insensitive /not found/ match cannot tell
    // `Resource not found: X` from `Not found: Resource not found: X`,
    // which is how the doubled prefix survived here.
    expect(result.content[0]?.text?.match(/not found/gi)).toHaveLength(1);
    expect(result.content[0]?.text).toBe('Resource not found: issue-123');
  });

  it('does not include stack traces in error output', () => {
    const err = new NotFoundError('Resource not found: issue-123');
    const result = toMcpError(err);
    const text = result.content[0]?.text ?? '';
    expect(text).not.toMatch(/at Object\./);
    expect(text).not.toMatch(/\.ts:\d+/);
  });

  it('returns isError: true for RateLimitError with retryAfter', () => {
    const err = new RateLimitError('Rate limit exceeded', 30);
    const result = toMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/30/);
  });

  it('returns isError: true for RateLimitError without retryAfter', () => {
    const err = new RateLimitError('Rate limit exceeded');
    const result = toMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/rate limit/i);
  });

  it('returns isError: true for AuthenticationError', () => {
    const err = new AuthenticationError();
    const result = toMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/RUSTRAK_API_TOKEN/);
  });

  it('returns isError: true for generic RustrakError', () => {
    const err = new BadRequestError('Invalid input');
    const result = toMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/Invalid input/);
  });

  it('returns isError: true for ServerError', () => {
    const err = new ServerError('Internal server error', 500);
    const result = toMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/Internal server error/);
  });

  it('returns isError: true for NetworkError', () => {
    const err = new NetworkError('Connection refused');
    const result = toMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/Connection refused/);
  });

  it('returns isError: true for unknown errors', () => {
    const err = new Error('Something unexpected');
    const result = toMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/Unexpected error/i);
  });

  it('returns isError: true for non-Error unknowns', () => {
    const result = toMcpError('string error');
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/Unexpected error/i);
  });

  it('content items have correct type literal', () => {
    const result = toMcpError(new NotFoundError('Resource not found: x'));
    // type must be exactly 'text' for MCP content
    expect(result.content[0]?.type).toBe('text');
  });
});
