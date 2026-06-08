import { z } from 'zod';
import { dateTimeSchema } from './common.js';
import { globalRoleSchema } from './team.js';

/**
 * Status of an invitation lifecycle (server returns a free-form string;
 * kept permissive to tolerate new statuses without breaking validation).
 */
export const invitationStatusSchema = z.string();

/**
 * Invitation schema - public-facing pending invitation.
 */
export const invitationSchema = z.object({
  token: z.string(),
  email: z.string().email(),
  role: globalRoleSchema,
  status: invitationStatusSchema,
  expires_at: dateTimeSchema,
  created_at: dateTimeSchema,
});

/**
 * Public-facing invitation info for the accept page (no token echoed back).
 */
export const invitationInfoSchema = z.object({
  email: z.string().email(),
  role: globalRoleSchema,
  status: invitationStatusSchema,
  expires_at: dateTimeSchema,
});

/**
 * Request body for creating an invitation.
 */
export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: globalRoleSchema,
});

/**
 * Request body for accepting an invitation (public endpoint).
 */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1),
});
