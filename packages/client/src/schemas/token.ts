import { z } from 'zod';
import { dateTimeSchema } from './common.js';

/**
 * Auth token response schema from list endpoint (masked)
 */
export const authTokenSchema = z.object({
  id: z.number().int(),
  token_prefix: z.string(),
  description: z.string().nullable(),
  created_at: dateTimeSchema,
  last_used_at: dateTimeSchema.nullable(),
});

/**
 * Auth token created response schema (full token shown once)
 */
export const authTokenCreatedSchema = z.object({
  id: z.number().int(),
  token: z.string(),
  description: z.string().nullable(),
  created_at: dateTimeSchema,
});

/**
 * Create auth token request schema
 */
export const createAuthTokenSchema = z.object({
  description: z.string().optional(),
});
