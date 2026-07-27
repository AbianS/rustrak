/**
 * The shape of a release, and the two things that read it on both sides of the
 * network.
 *
 * Split out of `changelog.ts` because that module opens the filesystem: a
 * client component importing so much as a date formatter from it dragged
 * `node:fs` into the browser bundle, which Turbopack refuses outright. Nothing
 * here touches the filesystem, so the feed can import it freely.
 */

export type ReleaseChannel = 'minor' | 'patch' | 'seed';

/** What a `##` block inside a release is about. Drives the accent only. */
export type SectionKind = 'shipped' | 'improved' | 'fixed' | 'documented';

export type ReleaseSection = {
  title: string;
  kind: SectionKind;
  /** Rendered Markdown. Authored in this repo, never user input. */
  html: string;
};

export type Release = {
  /** The filename, kept as a secondary anchor so old deep links still land. */
  slug: string;
  /** The stable anchor: `v0-13-0`. */
  anchor: string;
  version: string;
  channel: ReleaseChannel;
  title: string;
  description: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  tags: string[];
  sections: ReleaseSection[];
};

export type ReleaseChunk = {
  releases: Release[];
  hasMore: boolean;
};

export function parseVersion(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function safeDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `UTC` on purpose. The date is a release day, not a moment: rendered in the
 * reader's zone, a release cut in the morning in Europe reads as the previous
 * day west of the Atlantic, which puts entries out of order against the
 * version numbers beside them.
 */
export function formatReleaseDate(value: string): string {
  const date = safeDate(value);
  if (!date) return value;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
