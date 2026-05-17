import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerProjectTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'list_projects',
    {
      description: 'List all Rustrak projects you have access to.',
      inputSchema: {
        page: z.number().int().min(1).optional().describe('Page number'),
        per_page: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Items per page'),
      },
    },
    async ({ page, per_page }) => {
      try {
        const result = await client.projects.list({ page, per_page });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_project',
    {
      description: 'Get details for a single Rustrak project.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
      },
    },
    async ({ project_id }) => {
      try {
        const result = await client.projects.get(project_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'create_project',
    {
      description: 'Create a new Rustrak project.',
      inputSchema: {
        name: z.string().min(1).describe('Project name'),
        slug: z
          .string()
          .optional()
          .describe('URL-safe slug (auto-generated if omitted)'),
      },
    },
    async ({ name, slug }) => {
      try {
        const result = await client.projects.create({ name, slug });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
