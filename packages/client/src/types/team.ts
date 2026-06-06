import type { z } from 'zod';
import type {
  globalRoleSchema,
  teamMemberSchema,
  updateUserRoleSchema,
} from '../schemas/team.js';

/**
 * GlobalRole - a user's global role (`admin` | `member`)
 */
export type GlobalRole = z.infer<typeof globalRoleSchema>;

/**
 * TeamMember - a user as exposed on the team roster
 */
export type TeamMember = z.infer<typeof teamMemberSchema>;

/**
 * UpdateUserRole - request payload for changing a user's global role
 */
export type UpdateUserRole = z.infer<typeof updateUserRoleSchema>;
