'use server';

import type { Issue, Result, RustrakError } from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * Get issues first seen in a given release, most recently introduced first.
 *
 * The failure is returned, not swallowed. An empty array here renders "no new
 * issues introduced in this release", which is a claim about the release; a
 * fetch that failed makes no claim at all, and the two must not look the same
 * on a product whose whole job is telling you what broke.
 *
 * @param projectId - The project ID
 * @param release - Release version
 * @param limit - Max issues to return (default: 10, max: 50)
 */
export async function getNewIssuesForRelease(
  projectId: number,
  release: string,
  limit?: number,
): Promise<Result<Issue[], RustrakError>> {
  const client = await createClient();
  return client.releases.newIssues(projectId, release, limit);
}
