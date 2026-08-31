import { z } from 'zod';
import { dateTimeSchema } from './common.js';

/**
 * Provider type enum (replaces channel_type)
 *
 * `custom_webhook` POSTs a body rendered from a user-supplied Minijinja
 * template, which is how the fixed bot schemas (WeCom, DingTalk, Feishu)
 * get fed without a per-platform integration.
 */
export const providerTypeSchema = z.enum([
  'webhook',
  'email',
  'slack',
  'custom_webhook',
]);

/** @deprecated Use providerTypeSchema */
export const channelTypeSchema = providerTypeSchema;

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
 * Alert integration response schema (global credentials record)
 */
export const alertIntegrationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  provider_type: providerTypeSchema,
  credentials: z.record(z.string(), z.unknown()),
  is_enabled: z.boolean(),
  failure_count: z.number().int(),
  last_failure_at: dateTimeSchema.nullable(),
  last_failure_message: z.string().nullable(),
  last_success_at: dateTimeSchema.nullable(),
  created_at: dateTimeSchema,
  updated_at: dateTimeSchema,
});

/**
 * Create alert integration request schema
 */
export const createAlertIntegrationSchema = z.object({
  name: z.string().min(1),
  provider_type: providerTypeSchema,
  credentials: z.record(z.string(), z.unknown()),
  is_enabled: z.boolean().optional(),
});

/**
 * Update alert integration request schema
 */
export const updateAlertIntegrationSchema = z.object({
  name: z.string().min(1).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
  is_enabled: z.boolean().optional(),
});

/**
 * Per-rule channel routing entry schema
 */
export const alertRuleChannelInputSchema = z.object({
  integration_id: z.number().int(),
  routing_override: z.record(z.string(), z.unknown()).default({}),
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
  channels: z.array(alertRuleChannelInputSchema).default([]),
  integration_ids: z.array(z.number().int()),
});

/**
 * Create alert rule request schema
 */
export const createAlertRuleSchema = z.object({
  name: z.string().min(1),
  alert_type: alertTypeSchema,
  channels: z.array(alertRuleChannelInputSchema).default([]),
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
  channels: z.array(alertRuleChannelInputSchema).optional(),
});

/**
 * Alert history entry schema
 */
export const alertHistorySchema = z.object({
  id: z.number().int(),
  alert_rule_id: z.number().int().nullable(),
  integration_id: z.number().int().nullable(),
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

/**
 * Test integration request body schema
 */
export const testIntegrationBodySchema = z.object({
  routing_override: z.record(z.string(), z.unknown()).optional(),
});
