import { z } from 'zod';
import { dateTimeSchema, eventIdSchema, uuidSchema } from './common.js';

/**
 * Transaction response schema from list endpoint
 */
export const transactionSchema = z.object({
  id: uuidSchema,
  event_id: eventIdSchema,
  transaction_name: z.string(),
  timestamp: dateTimeSchema,
  start_timestamp: dateTimeSchema.nullable(),
  duration_ms: z.number().nullable(),
  platform: z.string(),
  environment: z.string(),
  release: z.string(),
  ingested_at: dateTimeSchema,
});

/**
 * Transaction detail schema from the detail endpoint.
 *
 * Same summary fields as {@link transactionSchema} plus the full Sentry
 * payload under `data` (spans, contexts.trace, measurements, tags, request,
 * user) used to render the span waterfall and metrics view.
 */
export const transactionDetailSchema = z.object({
  id: uuidSchema,
  event_id: eventIdSchema,
  transaction_name: z.string(),
  timestamp: dateTimeSchema,
  start_timestamp: dateTimeSchema.nullable(),
  duration_ms: z.number().nullable(),
  platform: z.string(),
  environment: z.string(),
  release: z.string(),
  ingested_at: dateTimeSchema,
  data: z.record(z.string(), z.any()), // Full Sentry transaction payload
});

/**
 * A single indexed span extracted from a transaction (waterfall row).
 */
export const spanSchema = z.object({
  id: uuidSchema,
  span_id: z.string().nullable(),
  trace_id: z.string().nullable(),
  parent_span_id: z.string().nullable(),
  op: z.string().nullable(),
  description: z.string().nullable(),
  status: z.string().nullable(),
  start_timestamp: dateTimeSchema.nullable(),
  timestamp: dateTimeSchema.nullable(),
  duration_ms: z.number().nullable(),
  exclusive_time_ms: z.number().nullable(),
  is_segment: z.boolean(),
  segment_id: z.string().nullable(),
});

/**
 * Aggregate performance stats for one (transaction_name, op) group.
 */
export const transactionStatsSchema = z.object({
  transaction_name: z.string(),
  op: z.string().nullable(),
  count: z.number().int(),
  p50_ms: z.number(),
  p95_ms: z.number(),
  p99_ms: z.number(),
  failure_rate: z.number(),
});
