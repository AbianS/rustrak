import {
  releaseHealthSchema,
  sessionSummarySchema,
  sessionTimeseriesSchema,
} from '../schemas/session.js';
import type {
  ReleaseHealth,
  SessionSummary,
  SessionTimeseries,
} from '../types/session.js';
import { BaseResource } from './base.js';

/**
 * Sessions API resource — release health stats.
 */
export class SessionsResource extends BaseResource {
  /**
   * Get per-release health stats for a project.
   * @param projectId - Project ID
   * @param period - Time window (e.g. '24h', '7d'). Defaults to '24h'.
   * @param release - Scope to a single release (all environments), computed
   *   server-side. Omit to get every release in the project.
   */
  async stats(
    projectId: number,
    period?: string,
    release?: string,
  ): Promise<ReleaseHealth> {
    const searchParams: Record<string, string> = {};
    if (period) {
      searchParams.period = period;
    }
    if (release) {
      searchParams.release = release;
    }

    const data = await this.http
      .get(`api/projects/${projectId}/sessions/stats`, { searchParams })
      .json();

    return this.validate(data, releaseHealthSchema);
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
