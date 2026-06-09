import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { toMcpError } from '../errors.js';

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
      try {
        const result = await client.health.getVersion();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
