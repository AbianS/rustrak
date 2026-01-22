import { z } from 'zod';
import { dateTimeSchema, uuidSchema } from './common.js';

/**
 * Event response schema from list endpoint
 */
export const eventSchema = z.object({
  id: uuidSchema,
  event_id: uuidSchema,
  issue_id: uuidSchema,
  title: z.string(),
  timestamp: dateTimeSchema,
  level: z.string(),
  platform: z.string(),
  release: z.string(),
  environment: z.string(),
});

/**
 * Event detail response schema from detail endpoint
 */
export const eventDetailSchema = z.object({
  id: uuidSchema,
  event_id: uuidSchema,
  issue_id: uuidSchema,
  title: z.string(),
  timestamp: dateTimeSchema,
  ingested_at: dateTimeSchema,
  level: z.string(),
  platform: z.string(),
  release: z.string(),
  environment: z.string(),
  server_name: z.string(),
  sdk_name: z.string(),
  sdk_version: z.string(),
  data: z.record(z.string(), z.any()), // Full Sentry event JSON
});
