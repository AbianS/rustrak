import { z } from 'zod';
import {
  activityEntrySchema,
  issueAggregatesSchema,
  issueHashSchema,
  issueSchema,
  issueStatsSchema,
  offsetPaginatedResponseSchema,
  tagValuesResponseSchema,
  updateIssueStateSchema,
  userReportSchema,
} from '../schemas/index.js';
import type {
  ActivityEntry,
  BulkDeleteIssues,
  BulkUpdateIssues,
  CreateComment,
  CreateDeploy,
  CreateUserReport,
  Issue,
  IssueAggregates,
  IssueHash,
  IssueStats,
  IssueStatsWindow,
  ListIssuesOptions,
  OffsetPaginatedResponse,
  TagValuesResponse,
  UpdateIssueState,
  UserReport,
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
    if (options?.q) {
      searchParams.q = options.q;
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
   * Update issue state (status, substatus, priority, assignment, …)
   */
  async updateState(
    projectId: number,
    issueId: string,
    input: UpdateIssueState,
  ): Promise<Issue> {
    const validatedInput = this.validate(input, updateIssueStateSchema);

    const data = await this.http
      .patch(`api/projects/${projectId}/issues/${issueId}`, {
        json: validatedInput,
      })
      .json();

    return this.validate(data, issueSchema);
  }

  /**
   * Resolve an issue in the next release (suppresses regression until a deploy).
   */
  async resolveInNextRelease(
    projectId: number,
    issueId: string,
  ): Promise<Issue> {
    return this.updateState(projectId, issueId, {
      status: 'resolvedInNextRelease',
    });
  }

  /**
   * Delete an issue
   */
  async delete(projectId: number, issueId: string): Promise<void> {
    await this.http.delete(`api/projects/${projectId}/issues/${issueId}`);
  }

  /**
   * Bulk-mutate issues (status and/or priority).
   */
  async bulkUpdate(
    projectId: number,
    input: BulkUpdateIssues,
  ): Promise<{ updated: number }> {
    const data = await this.http
      .put(`api/projects/${projectId}/issues`, { json: input })
      .json();
    return this.validate(data, z.object({ updated: z.number().int() }));
  }

  /**
   * Bulk-delete issues.
   */
  async bulkDelete(
    projectId: number,
    input: BulkDeleteIssues,
  ): Promise<{ deleted: number }> {
    const data = await this.http
      .delete(`api/projects/${projectId}/issues`, { json: input })
      .json();
    return this.validate(data, z.object({ deleted: z.number().int() }));
  }

  /**
   * List the grouping hashes that map to an issue.
   */
  async getHashes(projectId: number, issueId: string): Promise<IssueHash[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/issues/${issueId}/hashes`)
      .json();
    return this.validate(data, z.array(issueHashSchema));
  }

  /**
   * List the distinct values (with counts) for a tag key across the issue.
   */
  async getTagValues(
    projectId: number,
    issueId: string,
    key: string,
  ): Promise<TagValuesResponse> {
    const data = await this.http
      .get(`api/projects/${projectId}/issues/${issueId}/tags/${key}`)
      .json();
    return this.validate(data, tagValuesResponseSchema);
  }

  /**
   * Fetch per-issue aggregates (unique user count + top tags).
   */
  async getAggregates(
    projectId: number,
    issueId: string,
  ): Promise<IssueAggregates> {
    const data = await this.http
      .get(`api/projects/${projectId}/issues/${issueId}/aggregates`)
      .json();
    return this.validate(data, issueAggregatesSchema);
  }

  /**
   * Fetch a zero-filled event-count timeseries (24h or 30d).
   */
  async getStats(
    projectId: number,
    issueId: string,
    window: IssueStatsWindow = '24h',
  ): Promise<IssueStats> {
    const data = await this.http
      .get(`api/projects/${projectId}/issues/${issueId}/stats`, {
        searchParams: { window },
      })
      .json();
    return this.validate(data, issueStatsSchema);
  }

  /**
   * List an issue's activity log (status changes, comments/notes, …).
   */
  async getActivity(
    projectId: number,
    issueId: string,
  ): Promise<ActivityEntry[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/issues/${issueId}/activity`)
      .json();
    return this.validate(data, z.array(activityEntrySchema));
  }

  /**
   * Add a comment (note) to an issue.
   */
  async addComment(
    projectId: number,
    issueId: string,
    input: CreateComment,
  ): Promise<ActivityEntry> {
    const data = await this.http
      .post(`api/projects/${projectId}/issues/${issueId}/comments`, {
        json: input,
      })
      .json();
    return this.validate(data, activityEntrySchema);
  }

  /**
   * Set or clear the current user's bookmark on an issue.
   */
  async setBookmark(
    projectId: number,
    issueId: string,
    enabled: boolean,
  ): Promise<{ is_bookmarked: boolean }> {
    const data = await this.http
      .put(`api/projects/${projectId}/issues/${issueId}/bookmark`, {
        json: { enabled },
      })
      .json();
    return this.validate(data, z.object({ is_bookmarked: z.boolean() }));
  }

  /**
   * Set or clear the current user's subscription to an issue.
   */
  async setSubscription(
    projectId: number,
    issueId: string,
    enabled: boolean,
  ): Promise<{ is_subscribed: boolean }> {
    const data = await this.http
      .put(`api/projects/${projectId}/issues/${issueId}/subscription`, {
        json: { enabled },
      })
      .json();
    return this.validate(data, z.object({ is_subscribed: z.boolean() }));
  }

  /**
   * Mark the issue as seen by the current user.
   */
  async markSeen(
    projectId: number,
    issueId: string,
  ): Promise<{ has_seen: boolean }> {
    const data = await this.http
      .post(`api/projects/${projectId}/issues/${issueId}/seen`)
      .json();
    return this.validate(data, z.object({ has_seen: z.boolean() }));
  }

  /**
   * List user feedback reports for an issue.
   */
  async listUserReports(
    projectId: number,
    issueId: string,
  ): Promise<UserReport[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/issues/${issueId}/user-reports`)
      .json();
    return this.validate(data, z.array(userReportSchema));
  }

  /**
   * Attach a user feedback report to an issue.
   */
  async createUserReport(
    projectId: number,
    issueId: string,
    input: CreateUserReport,
  ): Promise<UserReport> {
    const data = await this.http
      .post(`api/projects/${projectId}/issues/${issueId}/user-reports`, {
        json: input,
      })
      .json();
    return this.validate(data, userReportSchema);
  }

  /**
   * Record a deploy of a release, finalizing resolve-in-next-release issues.
   */
  async createDeploy(
    projectId: number,
    input: CreateDeploy,
  ): Promise<{ version: string; finalized: number }> {
    const data = await this.http
      .post(`api/projects/${projectId}/deploys`, { json: input })
      .json();
    return this.validate(
      data,
      z.object({ version: z.string(), finalized: z.number().int() }),
    );
  }
}
