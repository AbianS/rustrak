import type { RustrakError } from '../errors.js';
import type { Result } from '../result.js';
import { createInvitationSchema, invitationSchema } from '../schemas/index.js';
import type { CreateInvitation, Invitation } from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Invitations API resource
 * Manages pending user invitations (admin only).
 */
export class InvitationsResource extends BaseResource {
  /**
   * Create a new invitation
   * @param input - Email and global role for the invited user
   */
  async create(
    input: CreateInvitation,
  ): Promise<Result<Invitation, RustrakError>> {
    const validatedInput = this.validateInput(input, createInvitationSchema);
    if (!validatedInput.success) {
      return validatedInput;
    }

    return this.request(
      () => this.http.post('api/invitations', { json: validatedInput.data }),
      invitationSchema,
    );
  }

  /**
   * List all invitations
   */
  async list(): Promise<Result<Invitation[], RustrakError>> {
    return this.request(
      () => this.http.get('api/invitations'),
      invitationSchema.array(),
    );
  }

  /**
   * Revoke a pending invitation
   * @param token - Invitation token to revoke
   */
  async revoke(token: string): Promise<Result<void, RustrakError>> {
    return this.requestVoid(() => this.http.delete(`api/invitations/${token}`));
  }
}
