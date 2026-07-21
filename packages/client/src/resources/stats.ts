import {
  eventTimeseriesSchema,
  projectStatsSummarySchema,
} from '../schemas/stats.js';
import type { EventTimeseries, ProjectStatsSummary } from '../types/stats.js';
import { BaseResource } from './base.js';

/**
 * Stats API resource — project-wide aggregates for the overview dashboard.
 *
 * Distinct from {@link SessionsResource}, which reports release health from
 * SDK session data. Everything here is derived from ingested error events and
 * issues.
 */
export class StatsResource extends BaseResource {
  /**
   * Get time-bucketed error-event volume for a project, split by severity.
   *
   * Buckets are zero-filled across the window, so a quiet hour comes back as a
   * point with `total: 0` rather than being absent. All-time requests (no
   * `period`) are sparse: there is no lower bound to fill from.
   *
   * @param projectId - Project ID
   * @param period - Time window (e.g. '24h', '7d'). Omit for all time.
   * @param interval - Bucket width in hours (default: 1, max: 24).
   */
  async timeseries(
    projectId: number,
    period?: string,
    interval?: number,
  ): Promise<EventTimeseries> {
    const searchParams: Record<string, string> = {};
    if (period) {
      searchParams.period = period;
    }
    if (interval !== undefined) {
      searchParams.interval = interval.toString();
    }

    const data = await this.http
      .get(`api/projects/${projectId}/events/stats`, { searchParams })
      .json();

    return this.validate(data, eventTimeseriesSchema);
  }

  /**
   * Get project-wide counters for a window, each paired with the same counter
   * over the window immediately before it.
   *
   * @param projectId - Project ID
   * @param period - Time window (e.g. '24h', '7d'). Omit for all time, which
   *   leaves every `previous` null.
   */
  async summary(
    projectId: number,
    period?: string,
  ): Promise<ProjectStatsSummary> {
    const searchParams: Record<string, string> = {};
    if (period) {
      searchParams.period = period;
    }

    const data = await this.http
      .get(`api/projects/${projectId}/stats/summary`, { searchParams })
      .json();

    return this.validate(data, projectStatsSummarySchema);
  }
}
