'use server';

import type {
  ActivityEntry,
  BulkDeleteIssues,
  BulkUpdateIssues,
  Issue,
  IssueAggregates,
  IssueStats,
  IssueStatsWindow,
  ListIssuesOptions,
  OffsetPaginatedResponse,
  Result,
  RustrakError,
  UpdateIssueState,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * List issues for a project with offset-based pagination.
 *
 * @param projectId - The project ID
 * @param options - Optional filtering and pagination options
 * @returns Paginated list of issues with total count
 */
export async function listIssues(
  projectId: number,
  options?: ListIssuesOptions,
): Promise<Result<OffsetPaginatedResponse<Issue>, RustrakError>> {
  const client = await createClient();
  return client.issues.list(projectId, options);
}

/**
 * Get a single issue by ID.
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 * @returns The issue
 */
export async function getIssue(
  projectId: number,
  issueId: string,
): Promise<Result<Issue, RustrakError>> {
  const client = await createClient();
  return client.issues.get(projectId, issueId);
}

/**
 * Update an issue's state (resolve, mute, etc.).
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 * @param state - The state updates to apply
 * @returns The updated issue
 */
export async function updateIssueState(
  projectId: number,
  issueId: string,
  state: UpdateIssueState,
): Promise<Result<Issue, RustrakError>> {
  const client = await createClient();
  return client.issues.updateState(projectId, issueId, state);
}

/**
 * Resolve an issue in the next release.
 *
 * Marks the issue resolved but tracks the pending release so a regression
 * before deploy reopens it; a recorded deploy finalizes the resolution.
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 * @returns The updated issue
 */
export async function resolveIssueInNextRelease(
  projectId: number,
  issueId: string,
): Promise<Result<Issue, RustrakError>> {
  const client = await createClient();
  return client.issues.resolveInNextRelease(projectId, issueId);
}

/**
 * Bulk-update a set of issues (status and/or priority) in one request.
 *
 * @param projectId - The project ID
 * @param body - The ids and fields to update
 */
export async function bulkUpdateIssues(
  projectId: number,
  body: BulkUpdateIssues,
): Promise<Result<{ updated: number }, RustrakError>> {
  const client = await createClient();
  return client.issues.bulkUpdate(projectId, body);
}

/**
 * Bulk-delete a set of issues in one request.
 *
 * @param projectId - The project ID
 * @param body - The ids to delete
 */
export async function bulkDeleteIssues(
  projectId: number,
  body: BulkDeleteIssues,
): Promise<Result<{ deleted: number }, RustrakError>> {
  const client = await createClient();
  return client.issues.bulkDelete(projectId, body);
}

/**
 * Get per-issue aggregates (unique user count + top tags).
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 */
export async function getIssueAggregates(
  projectId: number,
  issueId: string,
): Promise<Result<IssueAggregates, RustrakError>> {
  const client = await createClient();
  return client.issues.getAggregates(projectId, issueId);
}

/**
 * Get a zero-filled event-count timeseries for an issue (24h or 30d).
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 * @param window - The time window (`24h` or `30d`)
 */
export async function getIssueStats(
  projectId: number,
  issueId: string,
  window: IssueStatsWindow = '24h',
): Promise<Result<IssueStats, RustrakError>> {
  const client = await createClient();
  return client.issues.getStats(projectId, issueId, window);
}

/**
 * Get an issue's activity log (status changes, comments/notes, etc.).
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 */
export async function getIssueActivity(
  projectId: number,
  issueId: string,
): Promise<Result<ActivityEntry[], RustrakError>> {
  const client = await createClient();
  return client.issues.getActivity(projectId, issueId);
}

/**
 * Add a comment (note) to an issue's activity log.
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 * @param text - The comment body
 */
export async function addIssueComment(
  projectId: number,
  issueId: string,
  text: string,
): Promise<Result<ActivityEntry, RustrakError>> {
  const client = await createClient();
  return client.issues.addComment(projectId, issueId, { text });
}

/**
 * Toggle the current user's bookmark on an issue.
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 * @param enabled - Whether the issue should be bookmarked
 */
export async function setIssueBookmark(
  projectId: number,
  issueId: string,
  enabled: boolean,
): Promise<Result<{ is_bookmarked: boolean }, RustrakError>> {
  const client = await createClient();
  return client.issues.setBookmark(projectId, issueId, enabled);
}

/**
 * Toggle the current user's subscription to an issue's notifications.
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 * @param enabled - Whether the user should be subscribed
 */
export async function setIssueSubscription(
  projectId: number,
  issueId: string,
  enabled: boolean,
): Promise<Result<{ is_subscribed: boolean }, RustrakError>> {
  const client = await createClient();
  return client.issues.setSubscription(projectId, issueId, enabled);
}

/**
 * Delete an issue.
 *
 * @param projectId - The project ID
 * @param issueId - The issue UUID
 */
export async function deleteIssue(
  projectId: number,
  issueId: string,
): Promise<Result<void, RustrakError>> {
  const client = await createClient();
  return client.issues.delete(projectId, issueId);
}
