import {
  projectMemberSchema,
  upsertProjectMemberSchema,
} from '../schemas/index.js';
import type { ProjectMember, UpsertProjectMember } from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Project Members API resource
 * Manages per-project membership and roles.
 */
export class MembersResource extends BaseResource {
  /**
   * List members of a project
   * @param projectId - ID of the project
   */
  async list(projectId: number): Promise<ProjectMember[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/members`)
      .json();
    return this.validate(data, projectMemberSchema.array());
  }

  /**
   * Add or update a project member
   * @param projectId - ID of the project
   * @param input - User ID and per-project role
   */
  async upsert(projectId: number, input: UpsertProjectMember): Promise<void> {
    const validatedInput = this.validate(input, upsertProjectMemberSchema);
    await this.http.put(`api/projects/${projectId}/members`, {
      json: validatedInput,
    });
  }

  /**
   * Remove a member from a project
   * @param projectId - ID of the project
   * @param userId - ID of the user to remove
   */
  async remove(projectId: number, userId: number): Promise<void> {
    await this.http.delete(`api/projects/${projectId}/members/${userId}`);
  }
}
