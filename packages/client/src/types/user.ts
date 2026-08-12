import type { z } from 'zod';
import type {
  authResponseSchema,
  loginRequestSchema,
  loginResultSchema,
  registerRequestSchema,
  updatePreferencesRequestSchema,
  userSchema,
} from '../schemas/user.js';

/**
 * User - authenticated user information
 */
export type User = z.infer<typeof userSchema>;

/**
 * UpdatePreferencesRequest - how a reader wants the dashboard presented.
 *
 * A key left out leaves the stored value alone; a key sent as `null` clears it.
 */
export type UpdatePreferencesRequest = z.infer<
  typeof updatePreferencesRequestSchema
>;

/**
 * AuthResponse - returned after successful login or registration
 */
export type AuthResponse = z.infer<typeof authResponseSchema>;

/**
 * LoginResult - returned by login/register, includes user and session cookies
 * The cookies array contains raw Set-Cookie header values for use in Server Actions
 */
export type LoginResult = z.infer<typeof loginResultSchema>;

/**
 * LoginRequest - credentials for authentication
 */
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/**
 * RegisterRequest - data needed to create a new user account
 */
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
