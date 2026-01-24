import type { z } from 'zod';
import type {
  alertHistorySchema,
  alertRuleSchema,
  alertStatusSchema,
  alertTypeSchema,
  channelTypeSchema,
  createAlertRuleSchema,
  createNotificationChannelSchema,
  notificationChannelSchema,
  testChannelResponseSchema,
  updateAlertRuleSchema,
  updateNotificationChannelSchema,
} from '../schemas/alert.js';

/**
 * Channel type enum
 */
export type ChannelType = z.infer<typeof channelTypeSchema>;

/**
 * Alert type enum
 */
export type AlertType = z.infer<typeof alertTypeSchema>;

/**
 * Alert status enum
 */
export type AlertStatus = z.infer<typeof alertStatusSchema>;

/**
 * Notification channel (global alert destination)
 */
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

/**
 * Create notification channel request
 */
export type CreateNotificationChannel = z.infer<
  typeof createNotificationChannelSchema
>;

/**
 * Update notification channel request
 */
export type UpdateNotificationChannel = z.infer<
  typeof updateNotificationChannelSchema
>;

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
 * List alert history options
 */
export interface ListAlertHistoryOptions {
  limit?: number;
}
