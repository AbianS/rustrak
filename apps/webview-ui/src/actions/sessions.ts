'use server';

import type { ReleaseHealth } from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

/**
 * Get per-release health stats for a project.
 *
 * @param projectId - The project ID
 * @param period - Time window (e.g. '24h', '7d'). Defaults to '24h'.
 * @returns Array of per-release health rows, or empty array on error.
 */
export async function getReleaseHealth(
  projectId: number,
  period?: string,
): Promise<ReleaseHealth> {
  try {
    const client = await createClient();
    return await client.sessions.stats(projectId, period);
  } catch {
    return [];
  }
}
