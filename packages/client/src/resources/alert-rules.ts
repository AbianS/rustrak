import { z } from 'zod';
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
  async list(projectId: number): Promise<AlertRule[]> {
    const data = await this.http
      .get(`api/projects/${projectId}/alert-rules`)
      .json();
    return this.validate(data, z.array(alertRuleSchema));
  }

  /**
   * Get a single alert rule by ID
   */
  async get(projectId: number, ruleId: number): Promise<AlertRule> {
    const data = await this.http
      .get(`api/projects/${projectId}/alert-rules/${ruleId}`)
      .json();
    return this.validate(data, alertRuleSchema);
  }

  /**
   * Create a new alert rule for a project
   */
  async create(projectId: number, input: CreateAlertRule): Promise<AlertRule> {
    const validatedInput = this.validate(input, createAlertRuleSchema);

    const data = await this.http
      .post(`api/projects/${projectId}/alert-rules`, { json: validatedInput })
      .json();

    return this.validate(data, alertRuleSchema);
  }

  /**
   * Update an existing alert rule
   */
  async update(
    projectId: number,
    ruleId: number,
    input: UpdateAlertRule,
  ): Promise<AlertRule> {
    const validatedInput = this.validate(input, updateAlertRuleSchema);

    const data = await this.http
      .patch(`api/projects/${projectId}/alert-rules/${ruleId}`, {
        json: validatedInput,
      })
      .json();

    return this.validate(data, alertRuleSchema);
  }

  /**
   * Delete an alert rule
   */
  async delete(projectId: number, ruleId: number): Promise<void> {
    await this.http.delete(`api/projects/${projectId}/alert-rules/${ruleId}`);
  }

  /**
   * List alert history for a project
   */
  async listHistory(
    projectId: number,
    options?: ListAlertHistoryOptions,
  ): Promise<AlertHistory[]> {
    const searchParams = new URLSearchParams();

    if (options?.limit !== undefined) {
      searchParams.set('limit', options.limit.toString());
    }

    const query = searchParams.toString();
    const url = query
      ? `api/projects/${projectId}/alert-history?${query}`
      : `api/projects/${projectId}/alert-history`;

    const data = await this.http.get(url).json();
    return this.validate(data, z.array(alertHistorySchema));
  }
}
