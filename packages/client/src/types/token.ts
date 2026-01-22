import type { z } from 'zod';
import type {
  authTokenCreatedSchema,
  authTokenSchema,
  createAuthTokenSchema,
} from '../schemas/token.js';

/**
 * Auth token resource from list endpoint (masked)
 */
export type AuthToken = z.infer<typeof authTokenSchema>;

/**
 * Auth token resource when created (full token shown once)
 */
export type AuthTokenCreated = z.infer<typeof authTokenCreatedSchema>;

/**
 * Request payload for creating an auth token
 */
export type CreateAuthToken = z.infer<typeof createAuthTokenSchema>;
