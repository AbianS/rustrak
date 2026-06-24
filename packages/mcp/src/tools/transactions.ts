import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerTransactionTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'list_transactions',
    {
      description:
        'List performance transactions for a Rustrak project (newest first), with offset pagination and optional filters. Each transaction includes its name, duration in milliseconds, platform, environment, and release. Use name+op to list the samples of a single grouped transaction (see get_transaction_stats).',
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
        name: z
          .string()
          .optional()
          .describe(
            "Filter by exact transaction name (lists one group's samples)",
          ),
        op: z
          .string()
          .optional()
          .describe('Filter by trace operation, e.g. http.server'),
        status: z
          .string()
          .optional()
          .describe('Filter by trace status, e.g. ok'),
        environment: z.string().optional().describe('Filter by environment'),
        release: z.string().optional().describe('Filter by release'),
      },
    },
    async ({
      project_id,
      page,
      per_page,
      name,
      op,
      status,
      environment,
      release,
    }) => {
      try {
        const result = await client.transactions.list(project_id, {
          page,
          per_page,
          name,
          op,
          status,
          environment,
          release,
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
    'get_transaction',
    {
      description:
        'Get a single Rustrak transaction by ID with its full Sentry payload: the span list (waterfall), trace context, measurements (web vitals), tags, request and user. Use the transaction id from list_transactions.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        transaction_id: z.string().describe('Transaction ID (UUID)'),
      },
    },
    async ({ project_id, transaction_id }) => {
      try {
        const result = await client.transactions.get(
          project_id,
          transaction_id,
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
    'get_transaction_stats',
    {
      description:
        'Get aggregate performance stats for a Rustrak project, grouped by transaction name + operation: throughput (count), p50/p95/p99 latency, and failure rate. Offset-paginated, most frequent first. This is the performance overview — use it to find slow or failing transactions, then list_transactions with name+op to inspect samples.',
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
      },
    },
    async ({ project_id, page, per_page }) => {
      try {
        const result = await client.transactions.getStats(project_id, {
          page,
          per_page,
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
    'get_transaction_spans',
    {
      description:
        'Get the indexed spans extracted from a Rustrak transaction, in waterfall order. Each span carries op, description, status, duration and self (exclusive) time — use it to find the slowest operations within a trace.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        transaction_id: z.string().describe('Transaction ID (UUID)'),
      },
    },
    async ({ project_id, transaction_id }) => {
      try {
        const result = await client.transactions.getSpans(
          project_id,
          transaction_id,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
