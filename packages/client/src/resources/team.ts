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
  async list(): Promise<TeamMember[]> {
    const data = await this.http.get('api/team').json();
    return this.validate(data, teamMemberSchema.array());
  }

  /**
   * Change a user's global role
   * @param userId - ID of the user to update
   * @param role - New global role to assign
   */
  async updateRole(userId: number, role: GlobalRole): Promise<void> {
    const body = this.validate({ role }, updateUserRoleSchema);
    await this.http.patch(`api/team/${userId}/role`, { json: body });
  }

  /**
   * Permanently remove a user from the instance.
   * @param userId - ID of the user to delete
   */
  async remove(userId: number): Promise<void> {
    await this.http.delete(`api/team/${userId}`);
  }
}
