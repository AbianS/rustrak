import { z } from 'zod';
import {
  cleanupCountsSchema,
  cleanupOptionsSchema,
  projectStorageSchema,
  sourceMapGcResultSchema,
  storageSummarySchema,
} from '../schemas/index.js';
import type {
  CleanupCounts,
  CleanupOptions,
  ProjectStorage,
  SourceMapGcResult,
  StorageSummary,
} from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Storage API resource (admin only).
 *
 * Surfaces how much data the instance is holding and runs retention cleanups.
 */
export class StorageResource extends BaseResource {
  /**
   * Get the instance-wide storage summary: row counts per data category, the
   * whole-DB size, and exact source-map weight.
   */
  async getSummary(): Promise<StorageSummary> {
    const data = await this.http.get('api/storage/summary').json();
    return this.validate(data, storageSummarySchema);
  }

  /**
   * Get the per-project storage breakdown (one row per project, including
   * empty ones).
   */
  async getProjects(): Promise<ProjectStorage[]> {
    const data = await this.http.get('api/storage/projects').json();
    return this.validate(data, z.array(projectStorageSchema));
  }

  /**
   * Dry-run: count the rows a cleanup would remove. Mutates nothing — use it to
   * confirm impact before {@link executeCleanup}.
   */
  async previewCleanup(options: CleanupOptions): Promise<CleanupCounts> {
    const json = cleanupOptionsSchema.parse(options);
    const data = await this.http
      .post('api/storage/cleanup/preview', { json })
      .json();
    return this.validate(data, cleanupCountsSchema);
  }

  /**
   * Execute a cleanup: delete data older than `older_than_days` (optionally
   * scoped to one project) and remove any issue left with zero events.
   */
  async executeCleanup(options: CleanupOptions): Promise<CleanupCounts> {
    const json = cleanupOptionsSchema.parse(options);
    const data = await this.http.post('api/storage/cleanup', { json }).json();
    return this.validate(data, cleanupCountsSchema);
  }

  /**
   * Dry-run for {@link gcSourceMaps}: count the orphaned source-map files and
   * bytes a GC would reclaim. Mutates nothing.
   */
  async previewGcSourceMaps(): Promise<SourceMapGcResult> {
    const data = await this.http
      .post('api/storage/source-maps/gc/preview')
      .json();
    return this.validate(data, sourceMapGcResultSchema);
  }

  /**
   * Garbage-collect orphaned source maps: files no longer referenced by any
   * upload, removed from the DB and unlinked from disk. Safe — never touches
   * referenced files.
   */
  async gcSourceMaps(): Promise<SourceMapGcResult> {
    const data = await this.http.post('api/storage/source-maps/gc').json();
    return this.validate(data, sourceMapGcResultSchema);
  }
}
