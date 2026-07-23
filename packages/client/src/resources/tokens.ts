import type { RustrakError } from '../errors.js';
import type { Result } from '../result.js';
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
  async list(): Promise<Result<AuthToken[], RustrakError>> {
    return this.request(
      () => this.http.get('api/tokens'),
      authTokenSchema.array(),
    );
  }

  /**
   * Get a single auth token by ID (full token value).
   *
   * Previously returned a masked version, but the server now returns the
   * complete token for GET /api/tokens/{id}.
   */
  async get(id: number): Promise<Result<AuthTokenCreated, RustrakError>> {
    return this.request(
      () => this.http.get(`api/tokens/${id}`),
      authTokenCreatedSchema,
    );
  }

  /**
   * Create a new auth token
   * Note: The full token is only returned once during creation
   */
  async create(
    input: CreateAuthToken,
  ): Promise<Result<AuthTokenCreated, RustrakError>> {
    const validatedInput = this.validateInput(input, createAuthTokenSchema);
    if (!validatedInput.success) {
      return validatedInput;
    }

    return this.request(
      () => this.http.post('api/tokens', { json: validatedInput.data }),
      authTokenCreatedSchema,
    );
  }

  /**
   * Delete an auth token
   */
  async delete(id: number): Promise<Result<void, RustrakError>> {
    return this.requestVoid(() => this.http.delete(`api/tokens/${id}`));
  }
}
