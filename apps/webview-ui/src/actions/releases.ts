'use server';

import type { Issue } from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * Get issues first seen in a given release, most recently introduced first.
 *
 * @param projectId - The project ID
 * @param release - Release version
 * @param limit - Max issues to return (default: 10, max: 50)
 * @returns Array of issues, or empty array on error.
 */
export async function getNewIssuesForRelease(
  projectId: number,
  release: string,
  limit?: number,
): Promise<Issue[]> {
  try {
    const client = await createClient();
    return await client.releases.newIssues(projectId, release, limit);
  } catch (error) {
    console.error('getNewIssuesForRelease failed', {
      projectId,
      release,
      limit,
      error,
    });
    return [];
  }
}
