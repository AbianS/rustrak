import type { z } from 'zod';
import type {
  projectMemberSchema,
  projectRoleSchema,
  upsertProjectMemberSchema,
} from '../schemas/member.js';

/**
 * ProjectRole - a member's per-project role (`viewer` | `editor` | `admin`)
 */
export type ProjectRole = z.infer<typeof projectRoleSchema>;

/**
 * ProjectMember - a member of a project, joined with the user's email
 */
export type ProjectMember = z.infer<typeof projectMemberSchema>;

/**
 * UpsertProjectMember - request payload for adding or updating a project member
 */
export type UpsertProjectMember = z.infer<typeof upsertProjectMemberSchema>;
