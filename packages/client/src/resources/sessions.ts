import { offsetPaginatedResponseSchema } from '../schemas/common.js';
import {
  releaseHealthRowSchema,
  sessionSummarySchema,
  sessionTimeseriesSchema,
} from '../schemas/session.js';
import type {
  OffsetPaginatedResponse,
  ReleaseHealthStatsOptions,
} from '../types/common.js';
import type {
  ReleaseHealthRow,
  SessionSummary,
  SessionTimeseries,
} from '../types/session.js';
import { BaseResource } from './base.js';

/**
 * Sessions API resource — release health stats.
 */
export class SessionsResource extends BaseResource {
  /**
   * Get per-release health stats for a project, one offset-based page of
   * (release, environment) rows at a time, ordered by session volume.
   * @param projectId - Project ID
   * @param options - Time window, release scoping and pagination.
   */
  async stats(
    projectId: number,
    options?: ReleaseHealthStatsOptions,
  ): Promise<OffsetPaginatedResponse<ReleaseHealthRow>> {
    const searchParams: Record<string, string> = {};
    if (options?.period) {
      searchParams.period = options.period;
    }
    if (options?.release) {
      searchParams.release = options.release;
    }
    if (options?.page) {
      searchParams.page = String(options.page);
    }
    if (options?.per_page) {
      searchParams.per_page = String(options.per_page);
    }

    const data = await this.http
      .get(`api/projects/${projectId}/sessions/stats`, { searchParams })
      .json();

    return this.validate(
      data,
      offsetPaginatedResponseSchema(releaseHealthRowSchema),
    );
  }

  /**
   * Get project-wide session health, aggregated across all releases and environments.
   * @param projectId - Project ID
   * @param period - Time window (e.g. '24h', '7d'). Defaults to '24h'.
   */
  async summary(projectId: number, period?: string): Promise<SessionSummary> {
    const searchParams: Record<string, string> = {};
    if (period) {
      searchParams.period = period;
    }

    const data = await this.http
      .get(`api/projects/${projectId}/sessions/summary`, { searchParams })
      .json();

    return this.validate(data, sessionSummarySchema);
  }

  /**
   * Get a time-bucketed session trend for a project, aggregated across all
   * releases and environments.
   * @param projectId - Project ID
   * @param period - Time window (e.g. '24h', '7d'). Defaults to '24h'.
   * @param interval - Bucket width in hours (default: 1, max: 24).
   */
  async timeseries(
    projectId: number,
    period?: string,
    interval?: number,
  ): Promise<SessionTimeseries> {
    const searchParams: Record<string, string> = {};
    if (period) {
      searchParams.period = period;
    }
    if (interval !== undefined) {
      searchParams.interval = interval.toString();
    }

    const data = await this.http
      .get(`api/projects/${projectId}/sessions/timeseries`, { searchParams })
      .json();

    return this.validate(data, sessionTimeseriesSchema);
  }
}
