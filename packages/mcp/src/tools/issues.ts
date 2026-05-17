import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerIssueTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'list_issues',
    {
      description:
        'List issues for a Rustrak project. Returns paginated grouped error occurrences.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        page: z.number().int().min(1).optional(),
        per_page: z.number().int().min(1).max(100).optional(),
        filter: z
          .enum(['open', 'resolved', 'muted', 'all'])
          .optional()
          .describe('Filter issues by state (default: open)'),
      },
    },
    async ({ project_id, page, per_page, filter }) => {
      try {
        const result = await client.issues.list(project_id, {
          page,
          per_page,
          filter,
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
    'get_issue',
    {
      description: 'Get a single issue by ID.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
      },
    },
    async ({ project_id, issue_id }) => {
      try {
        const result = await client.issues.get(project_id, issue_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'resolve_issue',
    {
      description: 'Mark an issue as resolved.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
      },
    },
    async ({ project_id, issue_id }) => {
      try {
        const result = await client.issues.updateState(project_id, issue_id, {
          is_resolved: true,
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
    'unresolve_issue',
    {
      description: 'Mark a resolved issue as unresolved (re-open it).',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
      },
    },
    async ({ project_id, issue_id }) => {
      try {
        const result = await client.issues.updateState(project_id, issue_id, {
          is_resolved: false,
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
    'mute_issue',
    {
      description: 'Mute an issue so it no longer triggers alerts.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
      },
    },
    async ({ project_id, issue_id }) => {
      try {
        const result = await client.issues.updateState(project_id, issue_id, {
          is_muted: true,
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
    'delete_issue',
    {
      description: 'Permanently delete an issue and all its events.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ project_id, issue_id }) => {
      try {
        await client.issues.delete(project_id, issue_id);
        return {
          content: [
            { type: 'text', text: `Issue ${issue_id} deleted successfully.` },
          ],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
