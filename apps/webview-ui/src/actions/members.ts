'use server';

import type { ProjectMember, UpsertProjectMember } from '@rustrak/client';
import { RustrakError } from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

export type MemberMutationResult =
  | { success: true }
  | { success: false; error: string };

/**
 * List members of a project with their per-project role.
 *
 * @param projectId - The project ID
 * @returns List of project members
 */
export async function listProjectMembers(
  projectId: number,
): Promise<ProjectMember[]> {
  const client = await createClient();
  return client.members.list(projectId);
}

/**
 * Add or update a member of a project (upsert by user_id).
 *
 * The backend guards against unauthorized callers (only global admins
 * or project admins may manage members) and returns 403 otherwise.
 *
 * @param projectId - The project ID
 * @param input - The user_id and per-project role
 * @returns Result object describing success or a friendly error
 */
export async function upsertProjectMember(
  projectId: number,
  input: UpsertProjectMember,
): Promise<MemberMutationResult> {
  try {
    const client = await createClient();
    await client.members.upsert(projectId, input);
    return { success: true };
  } catch (err) {
    if (err instanceof RustrakError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to update member' };
  }
}

/**
 * Remove a member from a project.
 *
 * @param projectId - The project ID
 * @param userId - The user ID to remove
 * @returns Result object describing success or a friendly error
 */
export async function removeProjectMember(
  projectId: number,
  userId: number,
): Promise<MemberMutationResult> {
  try {
    const client = await createClient();
    await client.members.remove(projectId, userId);
    return { success: true };
  } catch (err) {
    if (err instanceof RustrakError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to remove member' };
  }
}
