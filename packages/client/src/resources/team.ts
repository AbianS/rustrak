import type { RustrakError } from '../errors.js';
import type { Result } from '../result.js';
import { teamMemberSchema, updateUserRoleSchema } from '../schemas/index.js';
import type { GlobalRole, TeamMember } from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Team API resource
 * Manages the global user roster and their global roles (admin only).
 */
export class TeamResource extends BaseResource {
  /**
   * List all team members (users)
   */
  async list(): Promise<Result<TeamMember[], RustrakError>> {
    return this.request(
      () => this.http.get('api/team'),
      teamMemberSchema.array(),
    );
  }

  /**
   * Change a user's global role
   * @param userId - ID of the user to update
   * @param role - New global role to assign
   */
  async updateRole(
    userId: number,
    role: GlobalRole,
  ): Promise<Result<void, RustrakError>> {
    const body = this.validateInput({ role }, updateUserRoleSchema);
    if (!body.success) {
      return body;
    }

    return this.requestVoid(() =>
      this.http.patch(`api/team/${userId}/role`, { json: body.data }),
    );
  }

  /**
   * Permanently remove a user from the instance.
   * @param userId - ID of the user to delete
   */
  async remove(userId: number): Promise<Result<void, RustrakError>> {
    return this.requestVoid(() => this.http.delete(`api/team/${userId}`));
  }
}
