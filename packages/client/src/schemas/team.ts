import { z } from 'zod';
import { dateTimeSchema } from './common.js';

/**
 * Global role assignable to a user (admin has full access, member is standard).
 */
export const globalRoleSchema = z.enum(['admin', 'member']);

/**
 * Team member schema - a user as exposed on the team roster.
 */
export const teamMemberSchema = z.object({
  id: z.number().int(),
  email: z.string().email(),
  role: globalRoleSchema,
  is_active: z.boolean(),
  /** True for the first-registered account, which cannot be demoted or deleted. */
  is_primary: z.boolean().optional(),
  created_at: dateTimeSchema,
  last_login: dateTimeSchema.nullable().optional(),
});

/**
 * Request body for changing a user's global role.
 */
export const updateUserRoleSchema = z.object({
  role: globalRoleSchema,
});
