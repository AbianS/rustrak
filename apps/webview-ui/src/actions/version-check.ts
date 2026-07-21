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

    // Picks the max explicitly instead of trusting feed order: versions.json is
    // sorted by date then slug, so a backported patch released after a later
    // minor would otherwise land first.
    const latest = feed.data.versions.reduce<
      (typeof feed.data.versions)[number] | undefined
    >((newest, entry) => {
      if (compareVersions(entry.version, current) <= 0) return newest;
      if (!newest || compareVersions(entry.version, newest.version) > 0)
        return entry;
      return newest;
    }, undefined);
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
