import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerSpanTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'list_spans',
    {
      description:
        'List spans for a Rustrak project (newest first), with offset pagination and optional filters. Covers spans regardless of origin — standalone "span" envelope items and spans extracted from transactions both share this table. Filter by operation_type (agent/tool/handoff/ai_client) to find AI Agent Monitoring spans specifically.',
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
        op: z
          .string()
          .optional()
          .describe('Filter by span operation, e.g. http.client'),
        status: z.string().optional().describe('Filter by span status'),
        trace_id: z.string().optional().describe('Filter by trace id'),
        operation_type: z
          .string()
          .optional()
          .describe(
            'Filter by gen_ai.operation.type (agent/tool/handoff/ai_client)',
          ),
      },
    },
    async ({
      project_id,
      page,
      per_page,
      op,
      status,
      trace_id,
      operation_type,
    }) => {
      try {
        const result = await client.spans.list(project_id, {
          page,
          per_page,
          op,
          status,
          trace_id,
          operation_type,
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
