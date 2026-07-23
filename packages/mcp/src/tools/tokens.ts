import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { mcpDone, mcpJson } from '../errors.js';

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
      const result = await client.tokens.list();
      return mcpJson(result);
    },
  );

  server.registerTool(
    'get_token',
    {
      description:
        'Get the full token value by ID. Returns the complete 40-character hex token — useful for copying or verifying credentials.',
      inputSchema: {
        token_id: z.number().int().describe('Token ID to retrieve'),
      },
    },
    async ({ token_id }) => {
      const result = await client.tokens.get(token_id);
      return mcpJson(result);
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
      const result = await client.tokens.create({ description });
      return mcpJson(result);
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
      const result = await client.tokens.delete(token_id);
      return mcpDone(result, `Token ${token_id} revoked successfully.`);
    },
  );
}
