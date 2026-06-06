'use server';

import type { GlobalRole, TeamMember } from '@rustrak/client';
import { RustrakError } from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

export type UpdateRoleResult =
  | { success: true }
  | { success: false; error: string };

/**
 * List all team members (instance users).
 *
 * @returns List of team members with their global role and status
 */
export async function listTeam(): Promise<TeamMember[]> {
  const client = await createClient();
  return client.team.list();
}

/**
 * Update a user's global role (admin/member).
 *
 * The backend guards against removing the last admin and against
 * unauthorized callers (only instance admins may change roles).
 *
 * @param userId - The user ID to update
 * @param role - The new global role
 * @returns Result object describing success or a friendly error
 */
export async function updateUserRole(
  userId: number,
  role: GlobalRole,
): Promise<UpdateRoleResult> {
  try {
    const client = await createClient();
    await client.team.updateRole(userId, role);
    return { success: true };
  } catch (err) {
    if (err instanceof RustrakError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to update role' };
  }
}

/**
 * Permanently remove a user from the instance.
 *
 * The backend guards against deleting yourself, the primary user, and the
 * last remaining admin.
 *
 * @param userId - The user ID to remove
 * @returns Result object describing success or a friendly error
 */
export async function removeTeamMember(
  userId: number,
): Promise<UpdateRoleResult> {
  try {
    const client = await createClient();
    await client.team.remove(userId);
    return { success: true };
  } catch (err) {
    if (err instanceof RustrakError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to remove member' };
  }
}
