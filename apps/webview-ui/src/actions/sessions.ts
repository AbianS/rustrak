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
