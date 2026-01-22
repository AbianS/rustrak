import {
  authTokenCreatedSchema,
  authTokenSchema,
  createAuthTokenSchema,
} from '../schemas/index.js';
import type {
  AuthToken,
  AuthTokenCreated,
  CreateAuthToken,
} from '../types/index.js';
import { BaseResource } from './base.js';

/**
 * Auth Tokens API resource
 */
export class TokensResource extends BaseResource {
  /**
   * List all auth tokens (masked)
   */
  async list(): Promise<AuthToken[]> {
    const data = await this.http.get('api/tokens').json();
    return this.validate(data, authTokenSchema.array());
  }

  /**
   * Get a single auth token by ID (masked)
   */
  async get(id: number): Promise<AuthToken> {
    const data = await this.http.get(`api/tokens/${id}`).json();
    return this.validate(data, authTokenSchema);
  }

  /**
   * Create a new auth token
   * Note: The full token is only returned once during creation
   */
  async create(input: CreateAuthToken): Promise<AuthTokenCreated> {
    // Validate input
    const validatedInput = this.validate(input, createAuthTokenSchema);

    const data = await this.http
      .post('api/tokens', { json: validatedInput })
      .json();

    return this.validate(data, authTokenCreatedSchema);
  }

  /**
   * Delete an auth token
   */
  async delete(id: number): Promise<void> {
    await this.http.delete(`api/tokens/${id}`);
  }
}
