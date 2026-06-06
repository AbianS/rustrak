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
  async create(input: CreateInvitation): Promise<Invitation> {
    const validatedInput = this.validate(input, createInvitationSchema);
    const data = await this.http
      .post('api/invitations', { json: validatedInput })
      .json();
    return this.validate(data, invitationSchema);
  }

  /**
   * List all invitations
   */
  async list(): Promise<Invitation[]> {
    const data = await this.http.get('api/invitations').json();
    return this.validate(data, invitationSchema.array());
  }

  /**
   * Revoke a pending invitation
   * @param token - Invitation token to revoke
   */
  async revoke(token: string): Promise<void> {
    await this.http.delete(`api/invitations/${token}`);
  }
}
