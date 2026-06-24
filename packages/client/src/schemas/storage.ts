import { z } from 'zod';

/**
 * Exact source-map storage weight, summed from the `size` columns of the
 * in-DB chunk table and the on-disk source_file CAS.
 */
export const sourceMapStorageSchema = z.object({
  chunk_bytes: z.number(),
  source_file_bytes: z.number(),
  total_bytes: z.number(),
  file_count: z.number(),
});

/**
 * Instance-wide storage summary: row counts per data category, whole-DB size
 * (best-effort, backend-reported), and exact source-map weight.
 */
export const storageSummarySchema = z.object({
  total_db_size_bytes: z.number(),
  events_count: z.number(),
  transactions_count: z.number(),
  spans_count: z.number(),
  source_maps: sourceMapStorageSchema,
});

/**
 * Per-project storage breakdown (one row per project, including empty ones).
 * `estimated_bytes` is the summed JSON payload length the project owns.
 */
export const projectStorageSchema = z.object({
  project_id: z.number(),
  project_name: z.string(),
  events_count: z.number(),
  transactions_count: z.number(),
  spans_count: z.number(),
  source_maps_count: z.number(),
  estimated_bytes: z.number(),
});

/**
 * Rows affected by a cleanup — used symmetrically for the dry-run preview
 * ("what would be removed") and the executed result ("what was removed").
 */
export const cleanupCountsSchema = z.object({
  events: z.number(),
  transactions: z.number(),
  spans: z.number(),
  issues_removed: z.number(),
});

/**
 * Outcome of a source-map garbage collection: orphaned files removed from the
 * DB and unlinked from disk, plus the exact bytes freed.
 */
export const sourceMapGcResultSchema = z.object({
  files_removed: z.number(),
  bytes_freed: z.number(),
});
