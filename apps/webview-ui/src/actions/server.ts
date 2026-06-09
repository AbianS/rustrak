'use server';

import type { ServerVersion } from '@rustrak/client';
import { createClient } from '@/lib/rustrak';

export async function getServerVersion(): Promise<ServerVersion | null> {
  try {
    const client = await createClient();
    return await client.health.getVersion();
  } catch {
    return null;
  }
}
