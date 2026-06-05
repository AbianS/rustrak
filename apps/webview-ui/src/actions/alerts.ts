'use server';

import type {
  AlertHistory,
  AlertIntegration,
  AlertRule,
  CreateAlertIntegration,
  CreateAlertRule,
  RoutingOverride,
  TestChannelResponse,
  UpdateAlertIntegration,
  UpdateAlertRule,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

// ============================================================================
// Alert Integrations (Global Credential Destinations)
// ============================================================================

export async function listIntegrations(): Promise<AlertIntegration[]> {
  const client = await createClient();
  return client.alertIntegrations.list();
}

export async function getIntegration(id: number): Promise<AlertIntegration> {
  const client = await createClient();
  return client.alertIntegrations.get(id);
}

export async function createIntegration(
  input: CreateAlertIntegration,
): Promise<AlertIntegration> {
  const client = await createClient();
  return client.alertIntegrations.create(input);
}

export async function updateIntegration(
  id: number,
  input: UpdateAlertIntegration,
): Promise<AlertIntegration> {
  const client = await createClient();
  return client.alertIntegrations.update(id, input);
}

export async function deleteIntegration(id: number): Promise<void> {
  const client = await createClient();
  await client.alertIntegrations.delete(id);
}

export async function testIntegration(
  id: number,
  routingOverride?: RoutingOverride,
): Promise<TestChannelResponse> {
  const client = await createClient();
  return client.alertIntegrations.test(id, routingOverride);
}

// Deprecated aliases — kept for backward compat
/** @deprecated Use listIntegrations */
export async function listNotificationChannels() {
  return listIntegrations();
}
/** @deprecated Use getIntegration */
export async function getNotificationChannel(id: number) {
  return getIntegration(id);
}
/** @deprecated Use createIntegration */
export async function createNotificationChannel(
  input: Parameters<typeof createIntegration>[0],
) {
  return createIntegration(input);
}
/** @deprecated Use updateIntegration */
export async function updateNotificationChannel(
  id: number,
  input: Parameters<typeof updateIntegration>[1],
) {
  return updateIntegration(id, input);
}
/** @deprecated Use deleteIntegration */
export async function deleteNotificationChannel(id: number) {
  return deleteIntegration(id);
}
/** @deprecated Use testIntegration */
export async function testNotificationChannel(id: number) {
  return testIntegration(id);
}

// ============================================================================
// Alert Rules (Per-Project Alert Configuration)
// ============================================================================

export async function listAlertRules(projectId: number): Promise<AlertRule[]> {
  const client = await createClient();
  return client.alertRules.list(projectId);
}

export async function getAlertRule(
  projectId: number,
  ruleId: number,
): Promise<AlertRule> {
  const client = await createClient();
  return client.alertRules.get(projectId, ruleId);
}

export async function createAlertRule(
  projectId: number,
  input: CreateAlertRule,
): Promise<AlertRule> {
  const client = await createClient();
  return client.alertRules.create(projectId, input);
}

export async function updateAlertRule(
  projectId: number,
  ruleId: number,
  input: UpdateAlertRule,
): Promise<AlertRule> {
  const client = await createClient();
  return client.alertRules.update(projectId, ruleId, input);
}

export async function deleteAlertRule(
  projectId: number,
  ruleId: number,
): Promise<void> {
  const client = await createClient();
  await client.alertRules.delete(projectId, ruleId);
}

export async function listAlertHistory(
  projectId: number,
  options?: { limit?: number },
): Promise<AlertHistory[]> {
  const client = await createClient();
  return client.alertRules.listHistory(projectId, options);
}
