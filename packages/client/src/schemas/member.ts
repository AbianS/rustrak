import { z } from 'zod';
import { dateTimeSchema } from './common.js';

/**
 * Per-project role assignable to a member.
 */
export const projectRoleSchema = z.enum(['viewer', 'editor', 'admin']);

/**
 * Project member schema - member row joined with the user's email.
 */
export const projectMemberSchema = z.object({
  user_id: z.number().int(),
  email: z.string().email(),
  role: projectRoleSchema,
  created_at: dateTimeSchema,
});

/**
 * Request body for adding or updating a project member.
 */
export const upsertProjectMemberSchema = z.object({
  user_id: z.number().int(),
  role: projectRoleSchema,
});
