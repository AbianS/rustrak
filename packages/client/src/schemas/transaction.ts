import { z } from 'zod';
import { dateTimeSchema, uuidSchema } from './common.js';

/**
 * Transaction response schema from list endpoint
 */
export const transactionSchema = z.object({
  id: uuidSchema,
  event_id: uuidSchema,
  transaction_name: z.string(),
  timestamp: dateTimeSchema,
  start_timestamp: dateTimeSchema.nullable(),
  duration_ms: z.number().nullable(),
  platform: z.string(),
  environment: z.string(),
  release: z.string(),
  ingested_at: dateTimeSchema,
});
