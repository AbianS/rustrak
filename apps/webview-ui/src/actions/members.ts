'use server';

import type {
  ProjectMember,
  Result,
  RustrakError,
  UpsertProjectMember,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * List members of a project with their per-project role.
 *
 * @param projectId - The project ID
 * @returns List of project members
 */
export async function listProjectMembers(
  projectId: number,
): Promise<Result<ProjectMember[], RustrakError>> {
  const client = await createClient();
  return client.members.list(projectId);
}

/**
 * Add or update a member of a project (upsert by user_id).
 *
 * The backend guards against unauthorized callers (only global admins
 * or project admins may manage members) and returns 403 otherwise.
 *
 * The `RustrakError` is returned rather than flattened to a string: the server
 * names `role` on a rejected role, and only the caller can decide which control
 * that belongs on.
 *
 * @param projectId - The project ID
 * @param input - The user_id and per-project role
 * @returns `Ok` on success, or the failure the server reported
 */
export async function upsertProjectMember(
  projectId: number,
  input: UpsertProjectMember,
): Promise<Result<void, RustrakError>> {
  const client = await createClient();
  return client.members.upsert(projectId, input);
}

/**
 * Remove a member from a project.
 *
 * @param projectId - The project ID
 * @param userId - The user ID to remove
 * @returns `Ok` on success, or the failure the server reported
 */
export async function removeProjectMember(
  projectId: number,
  userId: number,
): Promise<Result<void, RustrakError>> {
  const client = await createClient();
  return client.members.remove(projectId, userId);
}
