import type { z } from 'zod';
import type {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationInfoSchema,
  invitationSchema,
} from '../schemas/invitation.js';

/**
 * Invitation - public-facing pending invitation
 */
export type Invitation = z.infer<typeof invitationSchema>;

/**
 * InvitationInfo - public invitation details for the accept page
 */
export type InvitationInfo = z.infer<typeof invitationInfoSchema>;

/**
 * CreateInvitation - request payload for creating an invitation
 */
export type CreateInvitation = z.infer<typeof createInvitationSchema>;

/**
 * AcceptInvitation - request payload for accepting an invitation
 */
export type AcceptInvitation = z.infer<typeof acceptInvitationSchema>;
