import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerAlertTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'list_alert_channels',
    {
      description:
        'List all configured alert notification channels (Slack, email, webhook, etc.).',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await client.alertIntegrations.list();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'test_alert_channel',
    {
      description:
        'Send a test notification to an alert channel to verify it is configured correctly.',
      inputSchema: {
        channel_id: z.number().int().describe('Alert channel ID to test'),
      },
    },
    async ({ channel_id }) => {
      try {
        const result = await client.alertIntegrations.test(channel_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'list_alert_rules',
    {
      description: 'List all alert rules configured for a project.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
      },
    },
    async ({ project_id }) => {
      try {
        const result = await client.alertRules.list(project_id);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
