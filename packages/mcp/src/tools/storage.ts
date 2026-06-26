import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { toMcpError } from '../errors.js';

export function registerStorageTools(
  server: McpServer,
  client: RustrakClient,
): void {
  server.registerTool(
    'get_storage_summary',
    {
      description:
        'Get the instance-wide Rustrak storage summary (admin only): total database size, row counts for events, transactions, spans and logs, and the exact source-map weight. Use this to see what is consuming storage before cleaning up.',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await client.storage.getSummary();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'get_storage_by_project',
    {
      description:
        'Get the per-project Rustrak storage breakdown (admin only): event/transaction/span/source-map counts and estimated bytes for every project. Use this to find which project is accumulating the most data.',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await client.storage.getProjects();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'preview_storage_cleanup',
    {
      description:
        'Dry-run a Rustrak retention cleanup (admin only): report how many events, transactions, spans, logs and issues would be removed if data older than `older_than_days` were deleted, optionally scoped to one project. Mutates nothing — always run this before execute_storage_cleanup.',
      inputSchema: {
        older_than_days: z
          .number()
          .int()
          .min(1)
          .describe('Delete data older than this many days'),
        project_id: z
          .number()
          .int()
          .optional()
          .describe('Scope to one project (omit for all projects)'),
      },
    },
    async ({ older_than_days, project_id }) => {
      try {
        const result = await client.storage.previewCleanup({
          older_than_days,
          project_id,
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
    'execute_storage_cleanup',
    {
      description:
        'DESTRUCTIVE (admin only): permanently delete Rustrak data older than `older_than_days` (optionally scoped to one project) and remove any issue left with zero events. This cannot be undone. You MUST set confirm=true to proceed; without it the tool refuses and returns an error. Always run preview_storage_cleanup first and show the user the counts before confirming.',
      inputSchema: {
        older_than_days: z
          .number()
          .int()
          .min(1)
          .describe('Delete data older than this many days'),
        project_id: z
          .number()
          .int()
          .optional()
          .describe('Scope to one project (omit for all projects)'),
        confirm: z
          .boolean()
          .optional()
          .describe('Must be true to run this destructive cleanup'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ older_than_days, project_id, confirm }) => {
      if (confirm !== true) {
        return toMcpError(
          new Error(
            'execute_storage_cleanup is destructive and was not confirmed. Run preview_storage_cleanup first, then call again with confirm=true to proceed.',
          ),
        );
      }
      try {
        const result = await client.storage.executeCleanup({
          older_than_days,
          project_id,
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
    'preview_storage_source_maps_gc',
    {
      description:
        'Dry-run a Rustrak source-map garbage collection (admin only): report how many orphaned source-map files would be removed and how many bytes reclaimed, without deleting anything. Mutates nothing — always run this before gc_storage_source_maps.',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await client.storage.previewGcSourceMaps();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );

  server.registerTool(
    'gc_storage_source_maps',
    {
      description:
        'DESTRUCTIVE (admin only): permanently remove orphaned Rustrak source-map files no longer referenced by any upload (e.g. left behind by deleted projects), from the database and disk. This cannot be undone. You MUST set confirm=true to proceed; without it the tool refuses and returns an error. Always run preview_storage_source_maps_gc first and show the user the counts before confirming.',
      inputSchema: {
        confirm: z
          .boolean()
          .optional()
          .describe('Must be true to run this destructive cleanup'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ confirm }) => {
      if (confirm !== true) {
        return toMcpError(
          new Error(
            'gc_storage_source_maps is destructive and was not confirmed. Run preview_storage_source_maps_gc first, then call again with confirm=true to proceed.',
          ),
        );
      }
      try {
        const result = await client.storage.gcSourceMaps();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return toMcpError(err);
      }
    },
  );
}
