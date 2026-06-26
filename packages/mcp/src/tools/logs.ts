import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerLogTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'list_logs',
    {
      description:
        'List standalone logs for a Rustrak project (newest first by log timestamp), with offset pagination and optional filters. Each log includes its level, body (message), trace_id/span_id for correlation, severity number, and arbitrary attributes. Filter by level (trace/debug/info/warn/error/fatal) or by trace_id to see all logs for one trace.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
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
        level: z
          .string()
          .optional()
          .describe('Filter by log level, e.g. error'),
        trace_id: z
          .string()
          .optional()
          .describe('Filter by trace id (all logs for one trace)'),
      },
    },
    async ({ project_id, page, per_page, level, trace_id }) => {
      try {
        const result = await client.logs.list(project_id, {
          page,
          per_page,
          level,
          trace_id,
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
