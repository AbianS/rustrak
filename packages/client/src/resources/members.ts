import type { RustrakError } from '../errors.js';
import type { Result } from '../result.js';
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
  async list(
    projectId: number,
  ): Promise<Result<ProjectMember[], RustrakError>> {
    return this.request(
      () => this.http.get(`api/projects/${projectId}/members`),
      projectMemberSchema.array(),
    );
  }

  /**
   * Add or update a project member
   * @param projectId - ID of the project
   * @param input - User ID and per-project role
   */
  async upsert(
    projectId: number,
    input: UpsertProjectMember,
  ): Promise<Result<void, RustrakError>> {
    const validatedInput = this.validateInput(input, upsertProjectMemberSchema);
    if (!validatedInput.success) {
      return validatedInput;
    }

    return this.requestVoid(() =>
      this.http.put(`api/projects/${projectId}/members`, {
        json: validatedInput.data,
      }),
    );
  }

  /**
   * Remove a member from a project
   * @param projectId - ID of the project
   * @param userId - ID of the user to remove
   */
  async remove(
    projectId: number,
    userId: number,
  ): Promise<Result<void, RustrakError>> {
    return this.requestVoid(() =>
      this.http.delete(`api/projects/${projectId}/members/${userId}`),
    );
  }
}
