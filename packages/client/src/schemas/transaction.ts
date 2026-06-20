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
