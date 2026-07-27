import { z } from 'zod';
import type { RustrakError } from '../errors.js';
import type { Result } from '../result.js';
import {
  alertHistorySchema,
  alertRuleSchema,
  createAlertRuleSchema,
  updateAlertRuleSchema,
} from '../schemas/alert.js';
import type {
  AlertHistory,
  AlertRule,
  CreateAlertRule,
  ListAlertHistoryOptions,
  UpdateAlertRule,
} from '../types/alert.js';
import { BaseResource } from './base.js';

/**
 * Alert Rules API resource (per-project alert configuration)
 */
export class AlertRulesResource extends BaseResource {
  /**
   * List all alert rules for a project
   */
  async list(projectId: number): Promise<Result<AlertRule[], RustrakError>> {
    return this.request(
      () => this.http.get(`api/projects/${projectId}/alert-rules`),
      z.array(alertRuleSchema),
    );
  }

  /**
   * Get a single alert rule by ID
   */
  async get(
    projectId: number,
    ruleId: number,
  ): Promise<Result<AlertRule, RustrakError>> {
    return this.request(
      () => this.http.get(`api/projects/${projectId}/alert-rules/${ruleId}`),
      alertRuleSchema,
    );
  }

  /**
   * Create a new alert rule for a project
   */
  async create(
    projectId: number,
    input: CreateAlertRule,
  ): Promise<Result<AlertRule, RustrakError>> {
    const validatedInput = this.validateInput(input, createAlertRuleSchema);
    if (!validatedInput.success) {
      return validatedInput;
    }

    return this.request(
      () =>
        this.http.post(`api/projects/${projectId}/alert-rules`, {
          json: validatedInput.data,
        }),
      alertRuleSchema,
    );
  }

  /**
   * Update an existing alert rule
   */
  async update(
    projectId: number,
    ruleId: number,
    input: UpdateAlertRule,
  ): Promise<Result<AlertRule, RustrakError>> {
    const validatedInput = this.validateInput(input, updateAlertRuleSchema);
    if (!validatedInput.success) {
      return validatedInput;
    }

    return this.request(
      () =>
        this.http.patch(`api/projects/${projectId}/alert-rules/${ruleId}`, {
          json: validatedInput.data,
        }),
      alertRuleSchema,
    );
  }

  /**
   * Delete an alert rule
   */
  async delete(
    projectId: number,
    ruleId: number,
  ): Promise<Result<void, RustrakError>> {
    return this.requestVoid(() =>
      this.http.delete(`api/projects/${projectId}/alert-rules/${ruleId}`),
    );
  }

  /**
   * List alert history for a project
   */
  async listHistory(
    projectId: number,
    options?: ListAlertHistoryOptions,
  ): Promise<Result<AlertHistory[], RustrakError>> {
    const searchParams = new URLSearchParams();

    if (options?.limit !== undefined) {
      searchParams.set('limit', options.limit.toString());
    }

    const query = searchParams.toString();
    const url = query
      ? `api/projects/${projectId}/alert-history?${query}`
      : `api/projects/${projectId}/alert-history`;

    return this.request(() => this.http.get(url), z.array(alertHistorySchema));
  }
}
