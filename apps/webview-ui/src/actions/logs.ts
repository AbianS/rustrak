'use server';

import type {
  ListLogsOptions,
  Log,
  OffsetPaginatedResponse,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

export async function listLogs(
  projectId: number,
  options?: ListLogsOptions,
): Promise<OffsetPaginatedResponse<Log>> {
  const client = await createClient();
  return client.logs.list(projectId, options);
}
