'use server';

import type {
  ListLogsOptions,
  Log,
  OffsetPaginatedResponse,
  Result,
  RustrakError,
} from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

export async function listLogs(
  projectId: number,
  options?: ListLogsOptions,
): Promise<Result<OffsetPaginatedResponse<Log>, RustrakError>> {
  const client = await createClient();
  return client.logs.list(projectId, options);
}
