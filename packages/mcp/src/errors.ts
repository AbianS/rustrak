import type { Result, RustrakError } from '@rustrak/client';

/**
 * What every tool handler returns.
 *
 * `isError` is optional and only ever `true`: MCP treats its absence as
 * success, so there is no `isError: false` to represent.
 */
export type McpToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: true;
};

function mcpError(text: string): McpToolResult {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

/**
 * Turn a client failure into tool output the model can read.
 *
 * Takes the `RustrakError` union, not `unknown`: the client returns its
 * expected failures now instead of throwing them, so there is nothing left to
 * narrow and the switch below is total. A genuine programming error still
 * throws, and the MCP SDK turns that into an `isError` result of its own.
 */
export function toMcpError(error: RustrakError): McpToolResult {
  switch (error.kind) {
    case 'not_found':
      // No prefix of our own: the server's message already reads
      // `Resource not found: <detail>`, so adding one produced
      // `Not found: Resource not found: <detail>`.
      return mcpError(error.message);
    case 'rate_limited': {
      const after = error.retryAfter !== undefined ? error.retryAfter : '?';
      return mcpError(`Rate limited. Retry after: ${after}s`);
    }
    case 'unauthenticated':
      return mcpError('Authentication failed. Check RUSTRAK_API_TOKEN.');
    default:
      return mcpError(`API error: ${error.message}`);
  }
}

/**
 * Refuse a tool call the tool declined to make.
 *
 * The two destructive storage tools guard on `confirm` before touching the
 * API, so there is no `RustrakError` to hand to {@link toMcpError} and no
 * `API error:` prefix to justify: nothing failed, the call was never made.
 */
export function mcpRefusal(message: string): McpToolResult {
  return mcpError(message);
}

/**
 * Render a successful `Result` as pretty JSON, or its failure as tool output.
 *
 * This is the single place a tool decides what a failure looks like, which is
 * why no tool file needs a `try`/`catch` any more.
 */
export function mcpJson<T>(result: Result<T, RustrakError>): McpToolResult {
  if (!result.success) {
    return toMcpError(result.error);
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
  };
}

/**
 * Render a successful `Result` as a fixed confirmation line.
 *
 * For the `Result<void>` calls, where there is no payload to print. Going
 * through this helper is what keeps those honest: a failed `Result<void>` is a
 * value, so ignoring it is silent, and a tool that reported "deleted
 * successfully" after a 403 would be worse than one that threw.
 */
export function mcpDone(
  result: Result<unknown, RustrakError>,
  text: string,
): McpToolResult {
  if (!result.success) {
    return toMcpError(result.error);
  }
  return { content: [{ type: 'text', text }] };
}
