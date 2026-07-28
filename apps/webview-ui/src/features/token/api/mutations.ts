'use server';

import type {
  AuthTokenCreated,
  CreateAuthToken,
  Result,
  RustrakError,
} from '@rustrak/client';
import { createClient } from '@/shared/api/rustrak';

/**
 * List all auth tokens (masked).
 * The full token is never returned after creation.
 *
 * @returns List of auth tokens with masked token values
 */

/**
 * Create a new auth token.
 * The full token is only returned once during creation - save it immediately.
 *
 * @param input - Optional description for the token
 * @returns The created token with the full token value (shown only once)
 */
export async function createToken(
  input: CreateAuthToken,
): Promise<Result<AuthTokenCreated, RustrakError>> {
  const client = await createClient();
  return client.tokens.create(input);
}

/**
 * Delete an auth token.
 *
 * @param id - The token ID to delete
 */
export async function deleteToken(
  id: number,
): Promise<Result<void, RustrakError>> {
  const client = await createClient();
  return client.tokens.delete(id);
}

/**
 * Get the full token value by ID.
 *
 * @param id - The token ID to retrieve
 * @returns The full token value (40-char hex string)
 */
export async function getToken(
  id: number,
): Promise<Result<AuthTokenCreated, RustrakError>> {
  const client = await createClient();
  return client.tokens.get(id);
}
