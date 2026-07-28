import 'server-only';

/**
 * the instance version, read by the About page.
 *
 * `server-only`, not `'use server'`. Nothing in the browser calls this, so a
 * Server Action would turn a plain function call into a public POST endpoint
 * and buy nothing. The directive it carried was inherited from the flat
 * `actions/` directory, where every file had one whether or not it needed it.
 */
import type { Result, RustrakError, ServerVersion } from '@rustrak/client';
import { createClient } from '@/shared/api/rustrak';

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
