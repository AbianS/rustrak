import { releaseHealthSchema } from '../schemas/session.js';
import type { ReleaseHealth } from '../types/session.js';
import { BaseResource } from './base.js';

/**
 * Sessions API resource — release health stats.
 */
export class SessionsResource extends BaseResource {
  /**
   * Get per-release health stats for a project.
   * @param projectId - Project ID
   * @param period - Time window (e.g. '24h', '7d'). Defaults to '24h'.
   */
  async stats(projectId: number, period?: string): Promise<ReleaseHealth> {
    const searchParams: Record<string, string> = {};
    if (period) {
      searchParams.period = period;
    }

    const data = await this.http
      .get(`api/projects/${projectId}/sessions/stats`, { searchParams })
      .json();

    return this.validate(data, releaseHealthSchema);
  }
}
