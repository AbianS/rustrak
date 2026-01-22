import { z } from 'zod';
import { dateTimeSchema, uuidSchema } from './common.js';

/**
 * Issue response schema from API
 */
export const issueSchema = z.object({
  id: uuidSchema,
  project_id: z.number().int(),
  short_id: z.string(),
  title: z.string(),
  value: z.string(),
  first_seen: dateTimeSchema,
  last_seen: dateTimeSchema,
  event_count: z.number().int(),
  level: z.string().nullable(),
  platform: z.string().nullable(),
  is_resolved: z.boolean(),
  is_muted: z.boolean(),
});

/**
 * Update issue state request schema
 */
export const updateIssueStateSchema = z.object({
  is_resolved: z.boolean().optional(),
  is_muted: z.boolean().optional(),
});
