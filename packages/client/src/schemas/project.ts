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
  platform: z.string().nullable(),
});

/**
 * Create project request schema
 */
export const createProjectSchema = z.object({
  name: z.string().min(1),
  /**
   * Slugified server-side. Supplying it means the user chose it, so a taken
   * slug is a 409. Omitting it derives one from the name and silently
   * de-duplicates, since nobody chose that value.
   */
  slug: z.string().min(1).optional(),
  /**
   * Validated server-side against SELECTABLE_PLATFORMS. Omitting it leaves the
   * project eligible for platform auto-detection from its first event.
   */
  platform: z.string().min(1).optional(),
});

/**
 * Update project request schema
 */
export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  platform: z.string().min(1).optional(),
  /**
   * Slugified server-side. Unlike on create, a taken slug is a 409 rather than
   * being silently de-duplicated.
   */
  slug: z.string().min(1).optional(),
});
