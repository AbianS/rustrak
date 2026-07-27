'use server';

import type {
  GlobalRole,
  Result,
  RustrakError,
  TeamMember,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * List all team members (instance users).
 *
 * @returns List of team members with their global role and status
 */
export async function listTeam(): Promise<Result<TeamMember[], RustrakError>> {
  const client = await createClient();
  return client.team.list();
}

/**
 * Update a user's global role (admin/member).
 *
 * The backend guards against removing the last admin and against
 * unauthorized callers (only instance admins may change roles).
 *
 * The `RustrakError` is returned rather than flattened to a string, because the
 * server names `role` on the rejections it can attribute and the caller needs
 * `fields` to put the message on the control the user just changed.
 *
 * @param userId - The user ID to update
 * @param role - The new global role
 * @returns `Ok` on success, or the failure the server reported
 */
export async function updateUserRole(
  userId: number,
  role: GlobalRole,
): Promise<Result<void, RustrakError>> {
  const client = await createClient();
  return client.team.updateRole(userId, role);
}

/**
 * Permanently remove a user from the instance.
 *
 * The backend guards against deleting yourself, the primary user, and the
 * last remaining admin.
 *
 * @param userId - The user ID to remove
 * @returns `Ok` on success, or the failure the server reported
 */
export async function removeTeamMember(
  userId: number,
): Promise<Result<void, RustrakError>> {
  const client = await createClient();
  return client.team.remove(userId);
}
