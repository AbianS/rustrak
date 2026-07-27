import type { Metadata } from 'next';
import { ChangelogFeed } from '@/components/changelog/changelog-feed';
import {
  getChunkCount,
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
 * Two things shape this page. The first is that it grows forever: it rendered
 * every release in full on one URL, which was 604KB of HTML and climbing by a
 * release a fortnight, so only the first chunk is inlined now and the rest is
 * fetched (see `changelog-feed.tsx`). The second is that a changelog is read by
 * scanning, so the whole page is one ruled column with a fixed rhythm —
 * version strip, title, lead, numbered sections — and every entry is that same
 * shape whether it shipped one fix or five features.
 */
export default function ChangelogPage() {
  const releases = getReleases();
  const first = getReleaseChunk(1);
  const chunkCount = getChunkCount();
  const latest = releases[0];

  /*
    Both anchors of every release and the chunk it sits in. It is the only
    thing on the page that scales with the full list, and it is deliberate: at
    roughly 50 bytes an entry the whole map costs less than a single release
    would, and without it a deep link into an unfetched release silently does
    nothing.
  */
  const chunkByAnchor: Record<string, number> = {};
  releases.forEach((release, index) => {
    const chunk = Math.floor(index / RELEASES_PER_CHUNK) + 1;
    chunkByAnchor[release.anchor] = chunk;
    chunkByAnchor[release.slug] = chunk;
  });

  const stats = [
    { value: latest?.version ?? '—', label: 'Current release' },
    { value: String(releases.length), label: 'Releases shipped' },
    {
      value: latest ? formatReleaseDate(latest.date) : '—',
      label: 'Last published',
    },
  ];

  return (
    <div className="changelog-root mx-auto w-full max-w-[72rem] px-4 py-10 sm:px-6 sm:py-14">
      <div className="overflow-x-clip border-x border-t border-rule">
        <header className="border-b border-rule px-5 py-14 sm:px-9 sm:py-20">
          <span className="eyebrow">Changelog</span>
          <h1 className="display-xl mt-6 text-foreground">
            Every release, in order.
          </h1>
          <p className="mt-6 max-w-[56ch] text-[15.5px] leading-relaxed text-muted-foreground">
            The server, the dashboard and the client packages ship together
            under one version number. This is what each of those numbers
            carried.
          </p>
        </header>

        {/*
          The landing's figure treatment, so the two pages read as one site: a
          short primary rule turns a number into a labelled reading.

          Two up on a phone rather than three stacked, with the date taking the
          full row it needs. Stacked, the band alone was most of a phone screen
          and pushed the newest release — the thing the visitor came for —
          entirely below the fold.

          Each border is written out as a literal class rather than assembled
          from a variable: Tailwind scans source text, and a class name built
          from a prefix is never generated.
        */}
        <dl className="grid grid-cols-2 border-b border-rule sm:grid-cols-3">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={[
                'border-rule px-5 py-5 sm:px-9 sm:py-6',
                index === 0 ? 'border-b border-r sm:border-b-0' : '',
                index === 1 ? 'border-b sm:border-r sm:border-b-0' : '',
                index === 2 ? 'col-span-2 sm:col-span-1' : '',
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
        </dl>

        <ChangelogFeed
          initial={first.releases}
          chunkCount={chunkCount}
          total={releases.length}
          perChunk={RELEASES_PER_CHUNK}
          chunkByAnchor={chunkByAnchor}
        />
      </div>
    </div>
  );
}
