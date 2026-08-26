import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { mcpJson } from '../errors.js';

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
      const result = await client.projects.list({ page, per: per_page });
      return mcpJson(result);
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
      const result = await client.projects.get(project_id);
      return mcpJson(result);
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
      const result = await client.projects.create({ name, slug });
      return mcpJson(result);
    },
  );
}
