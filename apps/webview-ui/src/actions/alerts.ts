'use server';

import type {
  AlertHistory,
  AlertRule,
  CreateAlertRule,
  CreateNotificationChannel,
  NotificationChannel,
  TestChannelResponse,
  UpdateAlertRule,
  UpdateNotificationChannel,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

// ============================================================================
// Notification Channels (Global Alert Destinations)
// ============================================================================

/**
 * List all notification channels.
 *
 * @returns List of all configured notification channels
 */
export async function listNotificationChannels(): Promise<
  NotificationChannel[]
> {
  const client = await createClient();
  return client.alertChannels.list();
}

/**
 * Get a single notification channel by ID.
 *
 * @param id - The channel ID
 * @returns The notification channel
 */
export async function getNotificationChannel(
  id: number,
): Promise<NotificationChannel> {
  const client = await createClient();
  return client.alertChannels.get(id);
}

/**
 * Create a new notification channel.
 *
 * @param input - Channel configuration
 * @returns The created channel
 */
export async function createNotificationChannel(
  input: CreateNotificationChannel,
): Promise<NotificationChannel> {
  const client = await createClient();
  return client.alertChannels.create(input);
}

/**
 * Update an existing notification channel.
 *
 * @param id - The channel ID
 * @param input - Updated channel configuration
 * @returns The updated channel
 */
export async function updateNotificationChannel(
  id: number,
  input: UpdateNotificationChannel,
): Promise<NotificationChannel> {
  const client = await createClient();
  return client.alertChannels.update(id, input);
}

/**
 * Delete a notification channel.
 *
 * @param id - The channel ID to delete
 */
export async function deleteNotificationChannel(id: number): Promise<void> {
  const client = await createClient();
  await client.alertChannels.delete(id);
}

/**
 * Send a test notification to a channel.
 *
 * @param id - The channel ID to test
 * @returns Test result with success status and message
 */
export async function testNotificationChannel(
  id: number,
): Promise<TestChannelResponse> {
  const client = await createClient();
  return client.alertChannels.test(id);
}

// ============================================================================
// Alert Rules (Per-Project Alert Configuration)
// ============================================================================

/**
 * List all alert rules for a project.
 *
 * @param projectId - The project ID
 * @returns List of alert rules for the project
 */
export async function listAlertRules(projectId: number): Promise<AlertRule[]> {
  const client = await createClient();
  return client.alertRules.list(projectId);
}

/**
 * Get a single alert rule by ID.
 *
 * @param projectId - The project ID
 * @param ruleId - The rule ID
 * @returns The alert rule
 */
export async function getAlertRule(
  projectId: number,
  ruleId: number,
): Promise<AlertRule> {
  const client = await createClient();
  return client.alertRules.get(projectId, ruleId);
}

/**
 * Create a new alert rule for a project.
 *
 * @param projectId - The project ID
 * @param input - Rule configuration
 * @returns The created rule
 */
export async function createAlertRule(
  projectId: number,
  input: CreateAlertRule,
): Promise<AlertRule> {
  const client = await createClient();
  return client.alertRules.create(projectId, input);
}

/**
 * Update an existing alert rule.
 *
 * @param projectId - The project ID
 * @param ruleId - The rule ID
 * @param input - Updated rule configuration
 * @returns The updated rule
 */
export async function updateAlertRule(
  projectId: number,
  ruleId: number,
  input: UpdateAlertRule,
): Promise<AlertRule> {
  const client = await createClient();
  return client.alertRules.update(projectId, ruleId, input);
}

/**
 * Delete an alert rule.
 *
 * @param projectId - The project ID
 * @param ruleId - The rule ID to delete
 */
export async function deleteAlertRule(
  projectId: number,
  ruleId: number,
): Promise<void> {
  const client = await createClient();
  await client.alertRules.delete(projectId, ruleId);
}

/**
 * List alert history for a project.
 *
 * @param projectId - The project ID
 * @param options - Query options (limit)
 * @returns List of alert history entries
 */
export async function listAlertHistory(
  projectId: number,
  options?: { limit?: number },
): Promise<AlertHistory[]> {
  const client = await createClient();
  return client.alertRules.listHistory(projectId, options);
}
