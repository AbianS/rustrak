import 'server-only';

/**
 * Reads for the project feature.
 *
 * `stats` lives here rather than in a slice of its own: the aggregates are
 * *of a project*, not a concept a user manipulates.
 */
import {
  type EventTimeseries,
  type ListProjectsOptions,
  type OffsetPaginatedResponse,
  Ok,
  type Project,
  type ProjectStatsSummary,
  type Result,
  type RustrakError,
} from '@rustrak/client';
import { createClient } from '@/shared/api/rustrak';

/**
 * Get projects with pagination.
 *
 * @param options - Optional pagination options
 * @returns Paginated list of projects, or the failure that stopped it
 */
export async function getProjects(
  options?: ListProjectsOptions,
): Promise<Result<OffsetPaginatedResponse<Project>, RustrakError>> {
  const client = await createClient();
  return client.projects.list(options);
}

/** The largest page `/api/projects` will hand out, whatever `per` asks for. */
const MAX_PER = 100;

/**
 * Every project there is, walked a page at a time.
 *
 * A screen that lists projects to choose between needs all of them, and one
 * request cannot ask for all of them: the list contract clamps `per` to 100,
 * silently, so `per: 10000` is a first page wearing a whole set's clothes.
 * The walk stops at the first failure rather than returning a short list
 * nobody can tell is short.
 */
export async function getEveryProject(): Promise<
  Result<Project[], RustrakError>
> {
  const projects: Project[] = [];

  for (let page = 1; ; page += 1) {
    const result = await getProjects({ page, per: MAX_PER });
    if (!result.success) return result;

    projects.push(...result.data.items);

    // `total_pages` is what says when to stop; the empty page guards the
    // walk against a count that disagrees with what it hands out.
    if (page >= result.data.total_pages || result.data.items.length === 0) {
      return Ok(projects);
    }
  }
}

/**
 * Get a single project by ID.
 *
 * @param id - Project ID
 * @returns The project
 */
export async function getProject(
  id: number,
): Promise<Result<Project, RustrakError>> {
  const client = await createClient();
  return client.projects.get(id);
}

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
