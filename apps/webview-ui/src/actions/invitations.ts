'use server';

import type {
  CreateInvitation,
  Invitation,
  Result,
  RustrakError,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * List all pending/expired invitations.
 *
 * @returns List of invitations
 */
export async function listInvitations(): Promise<
  Result<Invitation[], RustrakError>
> {
  const client = await createClient();
  return client.invitations.list();
}

/**
 * Create a new invitation for a given email + role.
 *
 * v1 does not send email, so the returned invitation token must be
 * shared manually by the admin (used to build the invite link).
 *
 * The `RustrakError` is returned rather than flattened to a string: an address
 * that already has an account or a pending invite comes back as a `conflict`
 * naming `email`, and the form puts that on the email input instead of in a
 * toast the user has to translate back into an edit.
 *
 * @param input - Email and role for the invitee
 * @returns The created invitation, or the failure the server reported
 */
export async function createInvitation(
  input: CreateInvitation,
): Promise<Result<Invitation, RustrakError>> {
  const client = await createClient();
  return client.invitations.create(input);
}

/**
 * Revoke (delete) a pending invitation by its token.
 *
 * @param token - The invitation token to revoke
 * @returns `Ok` on success, or the failure the server reported
 */
export async function revokeInvitation(
  token: string,
): Promise<Result<void, RustrakError>> {
  const client = await createClient();
  return client.invitations.revoke(token);
}
