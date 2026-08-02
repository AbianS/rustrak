import type { Metadata } from 'next';
import { ChangelogFeed } from '@/components/changelog/changelog-feed';
import { Band, GridFrame } from '@/components/frame/grid';
import {
  getChunkCount,
  getPulse,
  getReleaseChunk,
  getReleases,
  RELEASES_PER_CHUNK,
} from '@/lib/changelog';
import { formatReleaseDate } from '@/lib/release';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Release notes and version history for the Rustrak project.',
};

/**
 * The changelog.
 *
 * Three things shape this page.
 *
 * The first is that it grows forever: it rendered every release in full on one
 * URL, which was 604KB of HTML and climbing by a release a fortnight, so only
 * the first chunk is inlined now and the rest is fetched (see
 * `changelog-feed.tsx`).
 *
 * The second is that a changelog is read by scanning, so the whole page is one
 * ruled column with a fixed rhythm (version strip, title, lead, numbered
 * sections) and every entry is that same shape whether it shipped one fix or
 * five features.
 *
 * The third is the one this redesign added. Forty-one entries down a single
 * column is an archive with no map, and the page had nothing to offer a reader
 * on a wide screen except a longer line of text. So the whole history is drawn
 * across the top as a band of columns (see `release-spectrum.tsx`), which is
 * both a picture of how the project moved and the index it never had. The
 * reading column is capped at a measure underneath it, which is what lets the
 * frame be wide enough to hold that band without the prose paying for it.
 *
 * The frame itself is `components/frame/grid`, shared with the landing and the
 * blog rather than redrawn here from the same four utility classes. It says
 * nothing about which shell the page sits in: this one is still inside the
 * documentation theme.
 */
export default function ChangelogPage() {
  const releases = getReleases();
  const first = getReleaseChunk(1);
  const chunkCount = getChunkCount();
  const pulse = getPulse();
  const latest = releases[0];

  /*
    Both anchors of every release and the chunk it sits in. It is the only
    thing on the page that scales with the full list, and it is deliberate: at
    roughly 50 bytes an entry the whole map costs less than a single release
    would, and without it a deep link into an unfetched release silently does
    nothing. The spectrum reads it too, for the same reason: it can address
    releases the page has not fetched.
  */
  const chunkByAnchor: Record<string, number> = {};
  releases.forEach((release, index) => {
    const chunk = Math.floor(index / RELEASES_PER_CHUNK) + 1;
    chunkByAnchor[release.anchor] = chunk;
    chunkByAnchor[release.slug] = chunk;
  });

  const changes = pulse.reduce((sum, entry) => sum + entry.total, 0);

  const stats = [
    { value: latest?.version ?? '—', label: 'Current release' },
    { value: String(releases.length), label: 'Releases shipped' },
    { value: String(changes), label: 'Changes logged' },
    {
      value: latest ? formatReleaseDate(latest.date) : '—',
      label: 'Last published',
    },
  ];

  return (
    <div className="changelog-root">
      <GridFrame measure="reading" topRule className="py-10 sm:py-14">
        {/*
          Headline and lead sit side by side from `lg`, rather than the lead
          hanging under a 72px headline in a column a third as wide as the one
          above it. Two blocks of type at two sizes, closing against the same
          baseline, is the header the rest of this frame is drawn in.
        */}
        <header className="px-5 py-14 sm:px-9 sm:py-16 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end lg:gap-x-12">
          <div>
            <span className="eyebrow">Changelog</span>
            <h1 className="display-lg mt-5 max-w-[16ch] text-foreground">
              Every release, in order.
            </h1>
          </div>
          <p className="mt-6 max-w-[52ch] text-[15.5px] leading-relaxed text-muted-foreground lg:mt-0">
            The server, the dashboard and the client packages ship together
            under one version number. This is what each of those numbers
            carried.
          </p>
        </header>

        {/*
          The landing's figure treatment, so the two pages read as one site: a
          short primary rule turns a number into a labelled reading.

          Two up on a phone rather than four stacked, which would have been most
          of a screen before the visitor reached anything they came for. Each
          border is written out as a literal class rather than assembled from a
          variable: Tailwind scans source text, and a class name built from a
          prefix is never generated.
        */}
        <Band
          as="dl"
          className="grid grid-cols-2 border-t border-rule sm:grid-cols-4"
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={[
                'border-rule px-5 py-5 sm:px-9 sm:py-6',
                index < 2 ? 'border-b sm:border-b-0' : '',
                index % 2 === 0 ? 'border-r' : '',
                index === 1 ? 'sm:border-r' : '',
              ].join(' ')}
            >
              <div className="border-l-2 border-primary pl-3">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-mono text-[17px] leading-none tracking-tight text-foreground">
                  {stat.value}
                </dd>
                <p
                  aria-hidden
                  className="mt-2 text-[12px] text-muted-foreground"
                >
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </Band>

        <ChangelogFeed
          initial={first.releases}
          chunkCount={chunkCount}
          total={releases.length}
          perChunk={RELEASES_PER_CHUNK}
          pulse={pulse}
          chunkByAnchor={chunkByAnchor}
        />
      </GridFrame>
    </div>
  );
}
