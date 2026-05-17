import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerTokenTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'list_tokens',
    {
      description:
        'List all API tokens. Token values are masked — only the prefix is shown.',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await client.tokens.list();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'create_token',
    {
      description:
        'Create a new API token. The full token value is returned ONCE — save it immediately.',
      inputSchema: {
        description: z
          .string()
          .min(1)
          .describe('Human-readable label for this token'),
      },
    },
    async ({ description }) => {
      try {
        const result = await client.tokens.create({ description });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'revoke_token',
    {
      description:
        'Permanently revoke an API token. This action cannot be undone.',
      inputSchema: {
        token_id: z.number().int().describe('Token ID to revoke'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ token_id }) => {
      try {
        await client.tokens.delete(token_id);
        return {
          content: [
            { type: 'text', text: `Token ${token_id} revoked successfully.` },
          ],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
