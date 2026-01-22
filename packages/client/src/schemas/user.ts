import { z } from 'zod';

/**
 * User schema - authenticated user information
 */
export const userSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  is_admin: z.boolean(),
});

/**
 * Auth response schema - returned after login/register
 */
export const authResponseSchema = z.object({
  user: userSchema,
});

/**
 * Login result schema - includes user and session cookies for Server Actions
 */
export const loginResultSchema = z.object({
  user: userSchema,
  cookies: z.array(z.string()),
});

/**
 * Login request schema
 */
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * Register request schema
 */
export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
