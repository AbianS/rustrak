import { z } from 'zod';
import {
  alertIntegrationSchema,
  createAlertIntegrationSchema,
  testChannelResponseSchema,
  testIntegrationBodySchema,
  updateAlertIntegrationSchema,
} from '../schemas/alert.js';
import type {
  AlertIntegration,
  CreateAlertIntegration,
  RoutingOverride,
  TestChannelResponse,
  UpdateAlertIntegration,
} from '../types/alert.js';
import { BaseResource } from './base.js';

/**
 * Alert Integrations API resource (global credential destinations)
 */
export class AlertIntegrationsResource extends BaseResource {
  /**
   * List all alert integrations
   */
  async list(): Promise<AlertIntegration[]> {
    const data = await this.http.get('api/integrations').json();
    return this.validate(data, z.array(alertIntegrationSchema));
  }

  /**
   * Get a single alert integration by ID
   */
  async get(id: number): Promise<AlertIntegration> {
    const data = await this.http.get(`api/integrations/${id}`).json();
    return this.validate(data, alertIntegrationSchema);
  }

  /**
   * Create a new alert integration
   */
  async create(input: CreateAlertIntegration): Promise<AlertIntegration> {
    const validatedInput = this.validate(input, createAlertIntegrationSchema);

    const data = await this.http
      .post('api/integrations', { json: validatedInput })
      .json();

    return this.validate(data, alertIntegrationSchema);
  }

  /**
   * Update an existing alert integration
   */
  async update(
    id: number,
    input: UpdateAlertIntegration,
  ): Promise<AlertIntegration> {
    const validatedInput = this.validate(input, updateAlertIntegrationSchema);

    const data = await this.http
      .patch(`api/integrations/${id}`, { json: validatedInput })
      .json();

    return this.validate(data, alertIntegrationSchema);
  }

  /**
   * Delete an alert integration
   */
  async delete(id: number): Promise<void> {
    await this.http.delete(`api/integrations/${id}`);
  }

  /**
   * Send a test notification to verify integration configuration.
   * For Slack bot_token integrations, routingOverride must include `channel`.
   */
  async test(
    id: number,
    routingOverride?: RoutingOverride,
  ): Promise<TestChannelResponse> {
    const body =
      routingOverride !== undefined
        ? this.validate(
            { routing_override: routingOverride },
            testIntegrationBodySchema,
          )
        : undefined;

    const data = await this.http
      .post(
        `api/integrations/${id}/test`,
        body !== undefined ? { json: body } : undefined,
      )
      .json();

    return this.validate(data, testChannelResponseSchema);
  }
}
