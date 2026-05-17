import {
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  RustrakError,
} from '@rustrak/client';

type McpErrorResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
};

function mcpError(text: string): McpErrorResult {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

export function toMcpError(err: unknown): McpErrorResult {
  if (err instanceof NotFoundError) {
    return mcpError(`Not found: ${err.message}`);
  }
  if (err instanceof RateLimitError) {
    const after = err.retryAfter !== undefined ? err.retryAfter : '?';
    return mcpError(`Rate limited. Retry after: ${after}s`);
  }
  if (err instanceof AuthenticationError) {
    return mcpError('Authentication failed. Check RUSTRAK_API_TOKEN.');
  }
  if (err instanceof RustrakError) {
    return mcpError(`API error: ${err.message}`);
  }
  return mcpError(`Unexpected error: ${String(err)}`);
}
