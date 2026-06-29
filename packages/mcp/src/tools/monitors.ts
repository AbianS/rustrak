import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerMonitorTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'list_monitors',
    {
      description:
        'List cron monitors (Sentry Crons) for a Rustrak project. Each monitor is a scheduled job tracked by check-ins; the response includes its slug, derived status (active/ok/error/missed/timeout/disabled), schedule (crontab or interval) and timezone, check-in margin and max runtime, and the last/next expected check-in times. Use this to see which scheduled jobs are healthy, failing, or have missed their window.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
      },
    },
    async ({ project_id }) => {
      try {
        const result = await client.monitors.list(project_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'list_monitor_check_ins',
    {
      description:
        'List check-ins (individual executions) for one cron monitor, identified by its slug, newest first with offset pagination. Each check-in includes its status (ok/error/in_progress/missed/timeout), duration in seconds, environment, and timestamp. Use this to inspect the recent run history of a scheduled job.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        slug: z.string().describe('Monitor slug'),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Page number (1-indexed, default 1)'),
        per_page: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Items per page (default 20, max 100)'),
      },
    },
    async ({ project_id, slug, page, per_page }) => {
      try {
        const result = await client.monitors.listCheckIns(project_id, slug, {
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
