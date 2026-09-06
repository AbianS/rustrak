'use server';

import type {
  AlertIntegration,
  AlertRule,
  CreateAlertIntegration,
  CreateAlertRule,
  PreviewTemplateResponse,
  Result,
  RoutingOverride,
  RustrakError,
  TestChannelResponse,
  UpdateAlertIntegration,
  UpdateAlertRule,
} from '@rustrak/client';
import { createClient } from '@/shared/api/rustrak';

// ============================================================================
// Alert Integrations (Global Credential Destinations)
// ============================================================================

export async function createIntegration(
  input: CreateAlertIntegration,
): Promise<Result<AlertIntegration, RustrakError>> {
  const client = await createClient();
  return client.alertIntegrations.create(input);
}

export async function updateIntegration(
  id: number,
  input: UpdateAlertIntegration,
): Promise<Result<AlertIntegration, RustrakError>> {
  const client = await createClient();
  return client.alertIntegrations.update(id, input);
}

export async function deleteIntegration(
  id: number,
): Promise<Result<void, RustrakError>> {
  const client = await createClient();
  return client.alertIntegrations.delete(id);
}

export async function testIntegration(
  id: number,
  routingOverride?: RoutingOverride,
): Promise<Result<TestChannelResponse, RustrakError>> {
  const client = await createClient();
  return client.alertIntegrations.test(id, routingOverride);
}

/**
 * Render a Custom Webhook body template against a sample payload.
 *
 * The dashboard cannot run the template engine, so the preview under the
 * editor comes from the server: the same renderer a delivery uses, which is
 * the only way the preview cannot lie about what will be sent.
 */
export async function previewTemplate(
  template: string,
): Promise<Result<PreviewTemplateResponse, RustrakError>> {
  const client = await createClient();
  return client.alertIntegrations.previewTemplate(template);
}

// ============================================================================
// Alert Rules (Per-Project Alert Configuration)
// ============================================================================

export async function createAlertRule(
  projectId: number,
  input: CreateAlertRule,
): Promise<Result<AlertRule, RustrakError>> {
  const client = await createClient();
  return client.alertRules.create(projectId, input);
}

export async function updateAlertRule(
  projectId: number,
  ruleId: number,
  input: UpdateAlertRule,
): Promise<Result<AlertRule, RustrakError>> {
  const client = await createClient();
  return client.alertRules.update(projectId, ruleId, input);
}

export async function deleteAlertRule(
  projectId: number,
  ruleId: number,
): Promise<Result<void, RustrakError>> {
  const client = await createClient();
  return client.alertRules.delete(projectId, ruleId);
}
