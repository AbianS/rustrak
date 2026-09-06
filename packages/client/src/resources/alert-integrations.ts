import { z } from 'zod';
import type { RustrakError } from '../errors.js';
import type { Result } from '../result.js';
import {
  alertIntegrationSchema,
  createAlertIntegrationSchema,
  previewTemplateResponseSchema,
  testChannelResponseSchema,
  testIntegrationBodySchema,
  updateAlertIntegrationSchema,
} from '../schemas/alert.js';
import type {
  AlertIntegration,
  CreateAlertIntegration,
  PreviewTemplateResponse,
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
  async list(): Promise<Result<AlertIntegration[], RustrakError>> {
    return this.request(
      () => this.http.get('api/integrations'),
      z.array(alertIntegrationSchema),
    );
  }

  /**
   * Get a single alert integration by ID
   */
  async get(id: number): Promise<Result<AlertIntegration, RustrakError>> {
    return this.request(
      () => this.http.get(`api/integrations/${id}`),
      alertIntegrationSchema,
    );
  }

  /**
   * Create a new alert integration
   */
  async create(
    input: CreateAlertIntegration,
  ): Promise<Result<AlertIntegration, RustrakError>> {
    const validatedInput = this.validateInput(
      input,
      createAlertIntegrationSchema,
    );
    if (!validatedInput.success) {
      return validatedInput;
    }

    return this.request(
      () => this.http.post('api/integrations', { json: validatedInput.data }),
      alertIntegrationSchema,
    );
  }

  /**
   * Update an existing alert integration
   */
  async update(
    id: number,
    input: UpdateAlertIntegration,
  ): Promise<Result<AlertIntegration, RustrakError>> {
    const validatedInput = this.validateInput(
      input,
      updateAlertIntegrationSchema,
    );
    if (!validatedInput.success) {
      return validatedInput;
    }

    return this.request(
      () =>
        this.http.patch(`api/integrations/${id}`, {
          json: validatedInput.data,
        }),
      alertIntegrationSchema,
    );
  }

  /**
   * Delete an alert integration
   */
  async delete(id: number): Promise<Result<void, RustrakError>> {
    return this.requestVoid(() => this.http.delete(`api/integrations/${id}`));
  }

  /**
   * Send a test notification to verify integration configuration.
   * For Slack bot_token integrations, routingOverride must include `channel`.
   */
  async test(
    id: number,
    routingOverride?: RoutingOverride,
  ): Promise<Result<TestChannelResponse, RustrakError>> {
    let body: unknown;

    if (routingOverride !== undefined) {
      const validatedInput = this.validateInput(
        { routing_override: routingOverride },
        testIntegrationBodySchema,
      );
      if (!validatedInput.success) {
        return validatedInput;
      }
      body = validatedInput.data;
    }

    return this.request(
      () =>
        this.http.post(
          `api/integrations/${id}/test`,
          body !== undefined ? { json: body } : undefined,
        ),
      testChannelResponseSchema,
    );
  }

  /**
   * Render a Custom Webhook template against a sample payload.
   *
   * Answers with the body that would be sent, or with why it would not
   * render. It goes to the server because the server owns the template
   * engine: a preview computed anywhere else would eventually disagree with
   * what a delivery actually sends.
   */
  async previewTemplate(
    template: string,
  ): Promise<Result<PreviewTemplateResponse, RustrakError>> {
    return this.request(
      () =>
        this.http.post('api/integrations/preview-template', {
          json: { template },
        }),
      previewTemplateResponseSchema,
    );
  }
}
