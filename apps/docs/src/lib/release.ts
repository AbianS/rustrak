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

/**
 * One release reduced to what the spectrum needs to draw it.
 *
 * The page ships ten releases and fetches the rest, but the spectrum has to
 * show the whole history from the first paint. A navigator that only knows
 * about the part of the archive already on screen is not a navigator. So every
 * release contributes this instead of its body: roughly 130 bytes, against the
 * ~15KB of a full entry. Forty-one of them cost less than a third of one
 * release, which is the same bargain the anchor map in `page.tsx` already
 * takes.
 */
export type ReleasePulse = {
  anchor: string;
  version: string;
  title: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  channel: ReleaseChannel;
  /**
   * Changes per kind. The counts are what give a column its height and its
   * banding, so a reader can see that v0.12.3 was twenty-two changes of mostly
   * new work and v0.10.2 was a two-line fix without opening either.
   */
  counts: Record<SectionKind, number>;
  /** The sum, precomputed because every consumer wants it. */
  total: number;
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
