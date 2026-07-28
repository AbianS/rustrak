import 'server-only';

/**
 * Reads for the token feature, called straight from Server Components.
 *
 * `import 'server-only'` is a build-time poison pill rather than a directive:
 * if this module reaches the client bundle the build fails, instead of shipping
 * a browser bundle that holds the session cookie.
 */
import type { AuthToken, Result, RustrakError } from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * List all auth tokens (masked).
 * The full token is never returned after creation.
 *
 * @returns List of auth tokens with masked token values
 */

/**
 * List all auth tokens (masked).
 * The full token is never returned after creation.
 *
 * @returns List of auth tokens with masked token values
 */
export async function listTokens(): Promise<Result<AuthToken[], RustrakError>> {
  const client = await createClient();
  return client.tokens.list();
}
