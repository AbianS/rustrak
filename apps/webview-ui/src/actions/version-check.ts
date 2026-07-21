'use server';

import { z } from 'zod';
import { getServerVersion } from '@/actions/server';
import { APP_VERSION } from '@/lib/constants';
import { compareVersions, type UpdateInfo } from '@/lib/version';

const VERSIONS_URL = 'https://rustrak.github.io/rustrak/versions.json';
const REVALIDATE_SECONDS = 3600;
const FETCH_TIMEOUT_MS = 3000;

const feedSchema = z.object({
  versions: z.array(
    z.object({
      version: z.string(),
      description: z.string().optional(),
      url: z.string(),
    }),
  ),
});

function isEnabled(): boolean {
  return process.env.RUSTRAK_VERSION_CHECK_ENABLED !== 'false';
}

export async function getUpdateInfo(): Promise<UpdateInfo | null> {
  if (!isEnabled()) return null;

  try {
    const current = (await getServerVersion())?.version ?? APP_VERSION;

    const response = await fetch(VERSIONS_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const feed = feedSchema.safeParse(await response.json());
    if (!feed.success) return null;

    const newer = feed.data.versions.filter(
      (entry) => compareVersions(entry.version, current) > 0,
    );
    const latest = newer[0];
    if (!latest) return null;

    return {
      current,
      latest: latest.version,
      description: latest.description ?? '',
      url: latest.url,
    };
  } catch {
    return null;
  }
}
