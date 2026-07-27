'use server';

import type {
  EventTimeseries,
  ProjectStatsSummary,
  Result,
  RustrakError,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * Get time-bucketed error-event volume for a project, split by severity.
 *
 * No catch: a fetch/auth failure must surface to the error boundary rather
 * than be disguised as a flat line at zero, which reads as "nothing is
 * breaking" — the most dangerous thing this page could say while wrong.
 *
 * @param projectId - The project ID
 * @param period - Time window (e.g. '24h', '7d'). Omit for all time.
 * @param interval - Bucket width in hours (default: 1, max: 24).
 */
export async function getProjectEventTimeseries(
  projectId: number,
  period?: string,
  interval?: number,
): Promise<Result<EventTimeseries, RustrakError>> {
  const client = await createClient();
  return client.stats.timeseries(projectId, period, interval);
}

/**
 * Get project-wide counters for the window, each with its previous-period
 * comparison.
 *
 * No catch, for the same reason as the timeseries above: zeroed counters are
 * indistinguishable from a genuinely quiet project.
 *
 * @param projectId - The project ID
 * @param period - Time window (e.g. '24h', '7d'). Omit for all time.
 */
export async function getProjectStatsSummary(
  projectId: number,
  period?: string,
): Promise<Result<ProjectStatsSummary, RustrakError>> {
  const client = await createClient();
  return client.stats.summary(projectId, period);
}
