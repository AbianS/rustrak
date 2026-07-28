'use server';

import type {
  CleanupCounts,
  CleanupOptions,
  ProjectStorage,
  Result,
  RustrakError,
  SourceMapGcResult,
  StorageSummary,
} from '@rustrak/client';
import { createClient } from '@/shared/api/rustrak';

/** Instance-wide storage summary (counts + DB size + source-map weight). */
export async function getStorageSummary(): Promise<
  Result<StorageSummary, RustrakError>
> {
  const client = await createClient();
  return client.storage.getSummary();
}

/** Per-project storage breakdown (one row per project). */
export async function getStorageProjects(): Promise<
  Result<ProjectStorage[], RustrakError>
> {
  const client = await createClient();
  return client.storage.getProjects();
}

/** Dry-run: count what a cleanup would remove. Mutates nothing. */
export async function previewStorageCleanup(
  options: CleanupOptions,
): Promise<Result<CleanupCounts, RustrakError>> {
  const client = await createClient();
  return client.storage.previewCleanup(options);
}

/** Execute a cleanup: permanently delete old data and emptied issues. */
export async function executeStorageCleanup(
  options: CleanupOptions,
): Promise<Result<CleanupCounts, RustrakError>> {
  const client = await createClient();
  return client.storage.executeCleanup(options);
}

/** Dry-run: count orphaned source maps a GC would remove. Mutates nothing. */
export async function previewStorageSourceMapGc(): Promise<
  Result<SourceMapGcResult, RustrakError>
> {
  const client = await createClient();
  return client.storage.previewGcSourceMaps();
}

/** Garbage-collect orphaned source maps (DB rows + disk files). */
export async function gcStorageSourceMaps(): Promise<
  Result<SourceMapGcResult, RustrakError>
> {
  const client = await createClient();
  return client.storage.gcSourceMaps();
}
