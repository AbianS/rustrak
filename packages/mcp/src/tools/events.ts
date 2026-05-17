import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerEventTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'list_events',
    {
      description:
        'List raw events for a specific issue. Events are individual error occurrences within a grouped issue.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
        cursor: z.string().optional().describe('Pagination cursor'),
        order: z
          .enum(['asc', 'desc'])
          .optional()
          .describe('Sort order (default: desc)'),
      },
    },
    async ({ project_id, issue_id, cursor, order }) => {
      try {
        const result = await client.events.list(project_id, issue_id, {
          cursor,
          order,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_event',
    {
      description:
        'Get full detail for a single event, including the complete Sentry envelope data.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
        event_id: z.string().describe('Event ID'),
      },
    },
    async ({ project_id, issue_id, event_id }) => {
      try {
        const result = await client.events.get(project_id, issue_id, event_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
