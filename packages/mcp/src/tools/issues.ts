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
        q: z
          .string()
          .optional()
          .describe(
            'Free-text search across type, value, transaction, culprit',
          ),
      },
    },
    async ({ project_id, page, per_page, filter, q }) => {
      try {
        const result = await client.issues.list(project_id, {
          page,
          per_page,
          filter,
          q,
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

  server.registerTool(
    'update_issue_status',
    {
      description:
        'Set an issue status (unresolved, resolved, ignored, or resolvedInNextRelease) and optionally its priority.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
        status: z
          .enum(['unresolved', 'resolved', 'ignored', 'resolvedInNextRelease'])
          .describe('New status'),
        priority: z.enum(['low', 'medium', 'high']).optional(),
      },
    },
    async ({ project_id, issue_id, status, priority }) => {
      try {
        const result = await client.issues.updateState(project_id, issue_id, {
          status,
          priority,
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
    'assign_issue',
    {
      description:
        'Assign an issue to a user (or clear the assignment with assigned_to=null).',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
        assigned_to: z
          .number()
          .int()
          .nullable()
          .describe('User ID to assign, or null to clear'),
        assignee_type: z.string().optional().describe('e.g. "user" or "team"'),
      },
    },
    async ({ project_id, issue_id, assigned_to, assignee_type }) => {
      try {
        const result = await client.issues.updateState(project_id, issue_id, {
          assigned_to,
          assignee_type,
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
    'bulk_update_issues',
    {
      description: 'Set the status and/or priority of multiple issues at once.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        ids: z.array(z.string()).describe('Issue IDs to update'),
        status: z
          .enum(['unresolved', 'resolved', 'ignored', 'resolvedInNextRelease'])
          .optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
      },
    },
    async ({ project_id, ids, status, priority }) => {
      try {
        const result = await client.issues.bulkUpdate(project_id, {
          ids,
          status,
          priority,
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
    'bulk_delete_issues',
    {
      description: 'Permanently delete multiple issues and all their events.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        ids: z.array(z.string()).describe('Issue IDs to delete'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ project_id, ids }) => {
      try {
        const result = await client.issues.bulkDelete(project_id, { ids });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_issue_hashes',
    {
      description: 'List the grouping hashes that map to an issue.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
      },
    },
    async ({ project_id, issue_id }) => {
      try {
        const result = await client.issues.getHashes(project_id, issue_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_issue_tag_values',
    {
      description:
        'List the distinct values (with counts) for a tag key across an issue.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
        key: z.string().describe('Tag key, e.g. "browser"'),
      },
    },
    async ({ project_id, issue_id, key }) => {
      try {
        const result = await client.issues.getTagValues(
          project_id,
          issue_id,
          key,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_issue_aggregates',
    {
      description:
        'Get per-issue aggregates: unique affected user count and top tags.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
      },
    },
    async ({ project_id, issue_id }) => {
      try {
        const result = await client.issues.getAggregates(project_id, issue_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_issue_stats',
    {
      description: 'Get an event-count timeseries for an issue (24h or 30d).',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
        window: z.enum(['24h', '30d']).optional().describe('Default: 24h'),
      },
    },
    async ({ project_id, issue_id, window }) => {
      try {
        const result = await client.issues.getStats(
          project_id,
          issue_id,
          window,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_issue_activity',
    {
      description:
        "List an issue's activity log (status changes, comments/notes, …).",
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
      },
    },
    async ({ project_id, issue_id }) => {
      try {
        const result = await client.issues.getActivity(project_id, issue_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'comment_on_issue',
    {
      description: 'Add a comment (note) to an issue.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
        text: z.string().describe('Comment body'),
      },
    },
    async ({ project_id, issue_id, text }) => {
      try {
        const result = await client.issues.addComment(project_id, issue_id, {
          text,
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
    'bookmark_issue',
    {
      description: 'Set or clear your bookmark on an issue.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
        enabled: z.boolean().describe('true to bookmark, false to clear'),
      },
    },
    async ({ project_id, issue_id, enabled }) => {
      try {
        const result = await client.issues.setBookmark(
          project_id,
          issue_id,
          enabled,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'subscribe_issue',
    {
      description: 'Subscribe to or unsubscribe from an issue.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
        enabled: z
          .boolean()
          .describe('true to subscribe, false to unsubscribe'),
      },
    },
    async ({ project_id, issue_id, enabled }) => {
      try {
        const result = await client.issues.setSubscription(
          project_id,
          issue_id,
          enabled,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'mark_issue_seen',
    {
      description: 'Mark an issue as seen by you.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
      },
    },
    async ({ project_id, issue_id }) => {
      try {
        const result = await client.issues.markSeen(project_id, issue_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'list_user_reports',
    {
      description: 'List user feedback reports attached to an issue.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
      },
    },
    async ({ project_id, issue_id }) => {
      try {
        const result = await client.issues.listUserReports(
          project_id,
          issue_id,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'submit_user_report',
    {
      description: 'Attach a user feedback report to an issue.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        issue_id: z.string().describe('Issue ID'),
        name: z.string().optional(),
        email: z.string().optional(),
        comments: z.string().optional(),
        event_id: z.string().optional(),
      },
    },
    async ({ project_id, issue_id, name, email, comments, event_id }) => {
      try {
        const result = await client.issues.createUserReport(
          project_id,
          issue_id,
          { name, email, comments, event_id },
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'record_deploy',
    {
      description:
        'Record a release deploy, finalizing issues resolved in the next release.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        version: z.string().describe('Release version that was deployed'),
      },
    },
    async ({ project_id, version }) => {
      try {
        const result = await client.issues.createDeploy(project_id, {
          version,
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
