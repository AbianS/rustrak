'use server';

import type {
  OffsetPaginatedResponse,
  ReleaseHealthRow,
  ReleaseHealthStatsOptions,
  SessionSummary,
  SessionTimeseries,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * Get one page of per-release health stats for a project.
 *
 * No catch: a fetch/auth failure must surface to the error boundary rather
 * than be disguised as an empty page.
 *
 * @param projectId - The project ID
 * @param options - Time window, release scoping and pagination.
 */
export async function getReleaseHealth(
  projectId: number,
  options?: ReleaseHealthStatsOptions,
): Promise<OffsetPaginatedResponse<ReleaseHealthRow>> {
  const client = await createClient();
  return client.sessions.stats(projectId, options);
}

/** Page size used when walking every row of a single release. */
const RELEASE_ROWS_PER_PAGE = 100;

/**
 * Get every health row for one release, across all its environments.
 *
 * The release detail page needs the complete set: a row missing from the
 * response renders an environment's cards blank even though the list linked
 * to it. One page holds every realistic environment count, so the loop
 * normally runs once, but it keeps going when a project has more.
 *
 * @param projectId - The project ID
 * @param release - The release version to scope to
 * @param period - Time window (e.g. '24h', '7d'). Omit for all time.
 */
export async function getAllReleaseHealthRows(
  projectId: number,
  release: string,
  period?: string,
): Promise<ReleaseHealthRow[]> {
  const client = await createClient();

  const rows: ReleaseHealthRow[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await client.sessions.stats(projectId, {
      release,
      period,
      page,
      per_page: RELEASE_ROWS_PER_PAGE,
    });
    rows.push(...response.items);
    totalPages = response.total_pages;
    page += 1;
  } while (page <= totalPages);

  return rows;
}

const EMPTY_SESSION_SUMMARY: SessionSummary = {
  total: 0,
  errored: 0,
  crashed: 0,
  abnormal: 0,
  crash_free_sessions_rate: null,
  crash_free_users_rate: null,
  active_releases: 0,
};

/**
 * Get project-wide session health, aggregated across all releases and environments.
 *
 * @param projectId - The project ID
 * @param period - Time window (e.g. '24h', '7d'). Defaults to '24h'.
 * @returns The summary, or a zeroed-out summary on error.
 */
export async function getSessionSummary(
  projectId: number,
  period?: string,
): Promise<SessionSummary> {
  try {
    const client = await createClient();
    return await client.sessions.summary(projectId, period);
  } catch (error) {
    console.error('getSessionSummary failed', { projectId, period, error });
    return EMPTY_SESSION_SUMMARY;
  }
}

/**
 * Get a time-bucketed session trend for a project, aggregated across all
 * releases and environments.
 *
 * @param projectId - The project ID
 * @param period - Time window (e.g. '24h', '7d'). Defaults to '24h'.
 * @param interval - Bucket width in hours (default: 1, max: 24).
 * @returns Array of trend points, or empty array on error.
 */
export async function getSessionTimeseries(
  projectId: number,
  period?: string,
  interval?: number,
): Promise<SessionTimeseries> {
  try {
    const client = await createClient();
    return await client.sessions.timeseries(projectId, period, interval);
  } catch (error) {
    console.error('getSessionTimeseries failed', {
      projectId,
      period,
      interval,
      error,
    });
    return [];
  }
}
