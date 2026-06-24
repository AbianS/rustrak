import type { z } from 'zod';
import type {
  cleanupCountsSchema,
  projectStorageSchema,
  sourceMapGcResultSchema,
  sourceMapStorageSchema,
  storageSummarySchema,
} from '../schemas/storage.js';

/** Exact source-map storage weight. */
export type SourceMapStorage = z.infer<typeof sourceMapStorageSchema>;

/** Instance-wide storage summary (counts + DB size + source-map weight). */
export type StorageSummary = z.infer<typeof storageSummarySchema>;

/** Per-project storage breakdown row. */
export type ProjectStorage = z.infer<typeof projectStorageSchema>;

/** Rows affected by a cleanup preview or execution. */
export type CleanupCounts = z.infer<typeof cleanupCountsSchema>;

/** Outcome of a source-map garbage collection. */
export type SourceMapGcResult = z.infer<typeof sourceMapGcResultSchema>;

/** Request body for a cleanup: remove data older than `older_than_days`,
 * optionally scoped to one project (omit for all projects). */
export interface CleanupOptions {
  older_than_days: number;
  project_id?: number;
}
