import {
  issueSchema,
  offsetPaginatedResponseSchema,
  updateIssueStateSchema,
} from '../schemas/index.js';
import type {
  Issue,
  ListIssuesOptions,
  OffsetPaginatedResponse,
  UpdateIssueState,
} from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Issues API resource
 */
export class IssuesResource extends BaseResource {
  /**
   * List issues for a project with offset-based pagination
   */
  async list(
    projectId: number,
    options?: ListIssuesOptions,
  ): Promise<OffsetPaginatedResponse<Issue>> {
    const searchParams: Record<string, string> = {};

    if (options?.page !== undefined) {
      searchParams.page = options.page.toString();
    }
    if (options?.per_page !== undefined) {
      searchParams.per_page = options.per_page.toString();
    }
    if (options?.sort) {
      searchParams.sort = options.sort;
    }
    if (options?.order) {
      searchParams.order = options.order;
    }
    if (options?.filter) {
      searchParams.filter = options.filter;
    }

    const data = await this.http
      .get(`api/projects/${projectId}/issues`, { searchParams })
      .json();

    return this.validate(data, offsetPaginatedResponseSchema(issueSchema));
  }

  /**
   * Get a single issue by ID
   */
  async get(projectId: number, issueId: string): Promise<Issue> {
    const data = await this.http
      .get(`api/projects/${projectId}/issues/${issueId}`)
      .json();

    return this.validate(data, issueSchema);
  }

  /**
   * Update issue state (resolve, mute, etc.)
   */
  async updateState(
    projectId: number,
    issueId: string,
    input: UpdateIssueState,
  ): Promise<Issue> {
    // Validate input
    const validatedInput = this.validate(input, updateIssueStateSchema);

    const data = await this.http
      .patch(`api/projects/${projectId}/issues/${issueId}`, {
        json: validatedInput,
      })
      .json();

    return this.validate(data, issueSchema);
  }

  /**
   * Delete an issue
   */
  async delete(projectId: number, issueId: string): Promise<void> {
    await this.http.delete(`api/projects/${projectId}/issues/${issueId}`);
  }
}
