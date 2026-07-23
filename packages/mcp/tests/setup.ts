import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { RustrakError } from '@rustrak/client';
import { createServer } from '../src/server.js';

/**
 * A successful `Result`, as every mocked client method now resolves to.
 *
 * The client stopped throwing in AD-10 phase 3a, so a mock that resolves with
 * bare data no longer stands in for the real thing: the tools read
 * `result.data`, and a bare value has none.
 */
export function ok<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

/**
 * A failed `Result`. Use this, not `mockRejectedValue`: an expected failure is
 * a returned value now, and a mock that rejects only exercises the SDK's own
 * throw handling rather than the tool's failure path.
 */
export function fail(error: RustrakError): {
  success: false;
  error: RustrakError;
} {
  return { success: false, error };
}

export type McpTextContent = { type: 'text'; text: string };
export type McpToolResult = { isError?: boolean; content: McpTextContent[] };

export async function createTestEnv(mockClient: unknown) {
  const server = createServer(mockClient as never);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: 'test', version: '1.0.0' });
  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);

  const callTool = (
    params: Parameters<typeof mcpClient.callTool>[0],
  ): Promise<McpToolResult> =>
    mcpClient.callTool(params) as Promise<McpToolResult>;

  return { mcpClient, server, callTool };
}
