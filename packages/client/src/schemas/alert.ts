import { z } from 'zod';
import { dateTimeSchema } from './common.js';

/**
 * Channel type enum
 */
export const channelTypeSchema = z.enum(['webhook', 'email', 'slack']);

/**
 * Alert type enum
 */
export const alertTypeSchema = z.enum(['new_issue', 'regression', 'unmute']);

/**
 * Alert status enum
 */
export const alertStatusSchema = z.enum([
  'pending',
  'sent',
  'failed',
  'skipped',
]);

/**
 * Notification channel response schema
 */
export const notificationChannelSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  channel_type: channelTypeSchema,
  config: z.record(z.string(), z.unknown()),
  is_enabled: z.boolean(),
  failure_count: z.number().int(),
  last_failure_at: dateTimeSchema.nullable(),
  last_failure_message: z.string().nullable(),
  last_success_at: dateTimeSchema.nullable(),
  created_at: dateTimeSchema,
  updated_at: dateTimeSchema,
});

/**
 * Create notification channel request schema
 */
export const createNotificationChannelSchema = z.object({
  name: z.string().min(1),
  channel_type: channelTypeSchema,
  config: z.record(z.string(), z.unknown()),
  is_enabled: z.boolean().optional(),
});

/**
 * Update notification channel request schema
 */
export const updateNotificationChannelSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
});

/**
 * Alert rule response schema
 */
export const alertRuleSchema = z.object({
  id: z.number().int(),
  project_id: z.number().int(),
  name: z.string(),
  alert_type: alertTypeSchema,
  is_enabled: z.boolean(),
  conditions: z.record(z.string(), z.unknown()),
  cooldown_minutes: z.number().int(),
  last_triggered_at: dateTimeSchema.nullable(),
  created_at: dateTimeSchema,
  updated_at: dateTimeSchema,
  channel_ids: z.array(z.number().int()),
});

/**
 * Create alert rule request schema
 */
export const createAlertRuleSchema = z.object({
  name: z.string().min(1),
  alert_type: alertTypeSchema,
  channel_ids: z.array(z.number().int()).min(1),
  is_enabled: z.boolean().optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  cooldown_minutes: z.number().int().min(0).optional(),
});

/**
 * Update alert rule request schema
 */
export const updateAlertRuleSchema = z.object({
  name: z.string().min(1).optional(),
  is_enabled: z.boolean().optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  cooldown_minutes: z.number().int().min(0).optional(),
  channel_ids: z.array(z.number().int()).optional(),
});

/**
 * Alert history entry schema
 */
export const alertHistorySchema = z.object({
  id: z.number().int(),
  alert_rule_id: z.number().int().nullable(),
  channel_id: z.number().int().nullable(),
  issue_id: z.string().uuid().nullable(),
  project_id: z.number().int().nullable(),
  alert_type: z.string(),
  channel_type: z.string(),
  channel_name: z.string(),
  status: alertStatusSchema,
  attempt_count: z.number().int(),
  next_retry_at: dateTimeSchema.nullable(),
  error_message: z.string().nullable(),
  http_status_code: z.number().int().nullable(),
  idempotency_key: z.string(),
  created_at: dateTimeSchema,
  sent_at: dateTimeSchema.nullable(),
});

/**
 * Test channel response schema
 */
export const testChannelResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
