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
        'Get per-release health stats for a Rustrak project: crash-free session rate, crash-free user rate, and error/crash/abnormal counts. Paginated, ordered by session volume.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        period: z
          .string()
          .optional()
          .describe("Time window for stats, e.g. '24h', '7d' (default: 24h)"),
        page: z
          .number()
          .int()
          .optional()
          .describe('Page number, 1-indexed (default: 1)'),
        per_page: z
          .number()
          .int()
          .optional()
          .describe('Rows per page (default: 20, max: 100)'),
      },
    },
    async ({ project_id, period, page, per_page }) => {
      try {
        const result = await client.sessions.stats(project_id, {
          period,
          page,
          per_page,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
