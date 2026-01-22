'use server';

import type {
  Issue,
  ListIssuesOptions,
  OffsetPaginatedResponse,
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
): Promise<OffsetPaginatedResponse<Issue>> {
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
): Promise<Issue> {
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
): Promise<Issue> {
  const client = await createClient();
  return client.issues.updateState(projectId, issueId, state);
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
): Promise<void> {
  const client = await createClient();
  await client.issues.delete(projectId, issueId);
}
