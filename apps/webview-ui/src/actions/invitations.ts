'use server';

import type { CreateInvitation, Invitation } from '@rustrak/client';
import { RustrakError } from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

export type CreateInvitationResult =
  | { success: true; invitation: Invitation }
  | { success: false; error: string };

export type RevokeInvitationResult =
  | { success: true }
  | { success: false; error: string };

/**
 * List all pending/expired invitations.
 *
 * @returns List of invitations
 */
export async function listInvitations(): Promise<Invitation[]> {
  const client = await createClient();
  return client.invitations.list();
}

/**
 * Create a new invitation for a given email + role.
 *
 * v1 does not send email, so the returned invitation token must be
 * shared manually by the admin (used to build the invite link).
 *
 * @param input - Email and role for the invitee
 * @returns Result object with the created invitation or a friendly error
 */
export async function createInvitation(
  input: CreateInvitation,
): Promise<CreateInvitationResult> {
  try {
    const client = await createClient();
    const invitation = await client.invitations.create(input);
    return { success: true, invitation };
  } catch (err) {
    if (err instanceof RustrakError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to create invitation' };
  }
}

/**
 * Revoke (delete) a pending invitation by its token.
 *
 * @param token - The invitation token to revoke
 * @returns Result object describing success or a friendly error
 */
export async function revokeInvitation(
  token: string,
): Promise<RevokeInvitationResult> {
  try {
    const client = await createClient();
    await client.invitations.revoke(token);
    return { success: true };
  } catch (err) {
    if (err instanceof RustrakError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to revoke invitation' };
  }
}
