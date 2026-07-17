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
 * A span row from the shared `spans` table — covers both origins
 * (transaction-embedded AND standalone "span" envelope items share this
 * table and this exact response shape), including gen_ai.* denormalized
 * fields when the span is recognized as an AI span.
 */
export const spanSchema = z.object({
  id: uuidSchema,
  /** Parent transaction, if this span was extracted from one. `null` for a standalone span. */
  transaction_id: uuidSchema.nullable(),
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
  /** Only ever set for standalone spans — a transaction-embedded span has no parent row to inherit these from. */
  platform: z.string().nullable(),
  release: z.string().nullable(),
  environment: z.string().nullable(),
  /** gen_ai.* denormalized fields — all null unless recognized as an AI span. */
  gen_ai_operation_type: z.string().nullable(),
  gen_ai_agent_name: z.string().nullable(),
  gen_ai_request_model: z.string().nullable(),
  gen_ai_response_model: z.string().nullable(),
  gen_ai_tool_name: z.string().nullable(),
  gen_ai_conversation_id: z.string().nullable(),
  gen_ai_usage_input_tokens: z.number().nullable(),
  gen_ai_usage_output_tokens: z.number().nullable(),
  gen_ai_usage_total_tokens: z.number().nullable(),
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
