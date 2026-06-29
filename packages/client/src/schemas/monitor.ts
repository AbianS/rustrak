import { z } from 'zod';
import { dateTimeSchema, uuidSchema } from './common.js';

/**
 * Monitor (scheduled job) response schema (Sentry Crons).
 *
 * Schedule config and derived state come from check-in payloads; `status` is
 * the monitor's current derived state (active/ok/error/missed/timeout/disabled).
 */
export const monitorSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  status: z.string(),
  schedule_type: z.string().nullable(),
  schedule_value: z.string().nullable(),
  schedule_unit: z.string().nullable(),
  timezone: z.string().nullable(),
  checkin_margin: z.number().int().nullable(),
  max_runtime: z.number().int().nullable(),
  last_check_in_at: dateTimeSchema.nullable(),
  last_check_in_status: z.string().nullable(),
  next_expected_at: dateTimeSchema.nullable(),
  created_at: dateTimeSchema,
});

/**
 * Wrapper for the (unpaginated) monitor list response.
 */
export const monitorsListResponseSchema = z.object({
  monitors: z.array(monitorSchema),
});

/**
 * A single check-in (one reported execution) of a monitor.
 */
export const checkInSchema = z.object({
  id: uuidSchema,
  status: z.string(),
  /** Duration in seconds. */
  duration: z.number().nullable(),
  environment: z.string().nullable(),
  trace_id: z.string().nullable(),
  timestamp: dateTimeSchema,
});
