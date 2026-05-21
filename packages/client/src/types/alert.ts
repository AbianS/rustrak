import type { z } from 'zod';
import type {
  alertHistorySchema,
  alertIntegrationSchema,
  alertRuleChannelInputSchema,
  alertRuleSchema,
  alertStatusSchema,
  alertTypeSchema,
  createAlertIntegrationSchema,
  createAlertRuleSchema,
  providerTypeSchema,
  testChannelResponseSchema,
  testIntegrationBodySchema,
  updateAlertIntegrationSchema,
  updateAlertRuleSchema,
} from '../schemas/alert.js';

/**
 * Provider type enum
 */
export type ProviderType = z.infer<typeof providerTypeSchema>;

/** @deprecated Use ProviderType */
export type ChannelType = ProviderType;

/**
 * Alert type enum
 */
export type AlertType = z.infer<typeof alertTypeSchema>;

/**
 * Alert status enum
 */
export type AlertStatus = z.infer<typeof alertStatusSchema>;

/**
 * Alert integration (global credentials record)
 */
export type AlertIntegration = z.infer<typeof alertIntegrationSchema>;

/** @deprecated Use AlertIntegration */
export type NotificationChannel = AlertIntegration;

/**
 * Create alert integration request
 */
export type CreateAlertIntegration = z.infer<
  typeof createAlertIntegrationSchema
>;

/** @deprecated Use CreateAlertIntegration */
export type CreateNotificationChannel = CreateAlertIntegration;

/**
 * Update alert integration request
 */
export type UpdateAlertIntegration = z.infer<
  typeof updateAlertIntegrationSchema
>;

/** @deprecated Use UpdateAlertIntegration */
export type UpdateNotificationChannel = UpdateAlertIntegration;

/**
 * Per-rule channel routing entry
 */
export type AlertRuleChannelInput = z.infer<typeof alertRuleChannelInputSchema>;

/**
 * Routing override — arbitrary key/value map passed to a dispatcher
 */
export type RoutingOverride = Record<string, unknown>;

/**
 * Alert rule (per-project trigger configuration)
 */
export type AlertRule = z.infer<typeof alertRuleSchema>;

/**
 * Create alert rule request
 */
export type CreateAlertRule = z.infer<typeof createAlertRuleSchema>;

/**
 * Update alert rule request
 */
export type UpdateAlertRule = z.infer<typeof updateAlertRuleSchema>;

/**
 * Alert history entry (audit log)
 */
export type AlertHistory = z.infer<typeof alertHistorySchema>;

/**
 * Test channel response
 */
export type TestChannelResponse = z.infer<typeof testChannelResponseSchema>;

/**
 * Test integration request body
 */
export type TestIntegrationBody = z.infer<typeof testIntegrationBodySchema>;

/**
 * List alert history options
 */
export interface ListAlertHistoryOptions {
  limit?: number;
}
