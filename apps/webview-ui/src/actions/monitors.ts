'use server';

import type {
  CheckIn,
  ListCheckInsOptions,
  Monitor,
  OffsetPaginatedResponse,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

export async function listMonitors(projectId: number): Promise<Monitor[]> {
  const client = await createClient();
  return client.monitors.list(projectId);
}

export async function listCheckIns(
  projectId: number,
  slug: string,
  options?: ListCheckInsOptions,
): Promise<OffsetPaginatedResponse<CheckIn>> {
  const client = await createClient();
  return client.monitors.listCheckIns(projectId, slug, options);
}
