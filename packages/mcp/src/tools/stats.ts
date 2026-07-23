import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { mcpJson } from '../errors.js';

export function registerStatsTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'get_error_volume',
    {
      description:
        'Get error-event volume over time for a Rustrak project, bucketed by severity (fatal, error, warning, info). Use this to see when a project started breaking, spot spikes, and compare severity mix across a window. Unlike get_issue_stats, which covers a single issue, this spans the whole project. Buckets are zero-filled, so a quiet bucket comes back with total 0 rather than being absent.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        period: z
          .string()
          .optional()
          .describe(
            "Time window, e.g. '24h', '7d', '30d'. Omit for all time. Clamped to 90 days.",
          ),
        interval: z
          .number()
          .int()
          .optional()
          .describe(
            'Bucket width in hours (default: 1, max: 24). Widen it for long windows so the series stays readable.',
          ),
      },
    },
    async ({ project_id, period, interval }) => {
      const result = await client.stats.timeseries(
        project_id,
        period,
        interval,
      );
      return mcpJson(result);
    },
  );

  server.registerTool(
    'get_project_stats',
    {
      description:
        'Get headline counters for a Rustrak project over a time window: error events, new issues, and currently open issues. Each windowed counter also carries the same figure for the window immediately before it, so you can state whether things are getting better or worse rather than just quoting a number. `previous` is null for all-time requests, where there is no earlier window to compare against.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        period: z
          .string()
          .optional()
          .describe(
            "Time window, e.g. '24h', '7d', '30d'. Omit for all time, which leaves every previous-period figure null. Clamped to 90 days.",
          ),
      },
    },
    async ({ project_id, period }) => {
      const result = await client.stats.summary(project_id, period);
      return mcpJson(result);
    },
  );
}
