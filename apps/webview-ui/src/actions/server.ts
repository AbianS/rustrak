'use server';

import type { Result, RustrakError, ServerVersion } from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * The version the server reports for itself.
 *
 * The failure is returned, not swallowed. This action used to collapse every
 * failure into `null` on the argument that the version is decorative, and that
 * argument holds for exactly one of its two callers. The About page can render
 * "unavailable" in a row and lose nothing. The update check cannot: it compares
 * this number against a published feed and puts a banner on every page from the
 * result, so a missing version there is not a blank cell, it is a comparison
 * made against something else. `null` gave the caller no way to tell "the
 * server is on 0.13.0" from "we never found out", and one of them was quietly
 * substituting the frontend's own bundled version for the server's.
 *
 * Whether the absence is worth reporting is the caller's decision, so the
 * caller is given the material to make it.
 */
export async function getServerVersion(): Promise<
  Result<ServerVersion, RustrakError>
> {
  const client = await createClient();
  return client.health.getVersion();
}
