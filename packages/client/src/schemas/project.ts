import { z } from 'zod';
import { dateTimeSchema, uuidSchema } from './common.js';

/**
 * Project response schema from API
 */
export const projectSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  sentry_key: uuidSchema,
  dsn: z.string(),
  stored_event_count: z.number().int(),
  digested_event_count: z.number().int(),
  created_at: dateTimeSchema,
  updated_at: dateTimeSchema,
});

/**
 * Create project request schema
 */
export const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
});

/**
 * Update project request schema
 */
export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
});
