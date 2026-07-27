import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { mcpJson } from '../errors.js';

export function registerHealthTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'get_server_version',
    {
      description: 'Get the Rustrak server version.',
      inputSchema: {},
    },
    async () => {
      const result = await client.health.getVersion();
      return mcpJson(result);
    },
  );
}
