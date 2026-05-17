import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';

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
