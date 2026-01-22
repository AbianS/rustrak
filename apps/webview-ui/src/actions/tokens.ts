'use server';

import type {
  AuthToken,
  AuthTokenCreated,
  CreateAuthToken,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * List all auth tokens (masked).
 * The full token is never returned after creation.
 *
 * @returns List of auth tokens with masked token values
 */
export async function listTokens(): Promise<AuthToken[]> {
  const client = await createClient();
  return client.tokens.list();
}

/**
 * Create a new auth token.
 * The full token is only returned once during creation - save it immediately.
 *
 * @param input - Optional description for the token
 * @returns The created token with the full token value (shown only once)
 */
export async function createToken(
  input: CreateAuthToken,
): Promise<AuthTokenCreated> {
  const client = await createClient();
  return client.tokens.create(input);
}

/**
 * Delete an auth token.
 *
 * @param id - The token ID to delete
 */
export async function deleteToken(id: number): Promise<void> {
  const client = await createClient();
  await client.tokens.delete(id);
}
