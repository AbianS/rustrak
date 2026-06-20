import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerTransactionTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'list_transactions',
    {
      description:
        'List performance transactions for a Rustrak project (newest first), with cursor-based pagination. Each transaction includes its name, duration in milliseconds, platform, environment, and release — the performance metrics sent by Sentry SDKs.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        cursor: z
          .string()
          .optional()
          .describe('Pagination cursor from a previous response (opaque)'),
      },
    },
    async ({ project_id, cursor }) => {
      try {
        const result = await client.transactions.list(project_id, { cursor });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
