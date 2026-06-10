import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerSessionTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'get_release_health',
    {
      description:
        'Get per-release health stats for a Rustrak project: crash-free session rate, crash-free user rate, and error/crash/abnormal counts.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        period: z
          .string()
          .optional()
          .describe("Time window for stats, e.g. '24h', '7d' (default: 24h)"),
      },
    },
    async ({ project_id, period }) => {
      try {
        const result = await client.sessions.stats(project_id, period);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
