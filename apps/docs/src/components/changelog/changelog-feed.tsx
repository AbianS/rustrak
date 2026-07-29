'use client';

import { useRef } from 'react';
import type { Release, ReleasePulse } from '@/lib/release';
import { ArchiveFooter } from './archive-footer';
import { ReleaseArticle } from './release-article';
import { ReleaseSpectrum } from './release-spectrum';
import { useActiveRelease } from './use-active-release';
import { useReleaseArchive } from './use-release-archive';

/**
 * The feed, and the only client code on the page.
 *
 * It is composition and nothing else. The archive's fetching lives in
 * `use-release-archive.ts` and the reading position in `use-active-release.ts`.
 * What is left here is the order the page is drawn in, which is worth being
 * able to read at a glance:
 *
 *   spectrum · sentinel · pinned spectrum · releases · footer
 *
 * That pairing of the spectrum with the archive is not incidental. The spectrum
 * can address all forty-one releases while the page holds ten, so every jump it
 * offers may need a fetch first, the same machinery a deep link needs, which
 * is why one hook serves both.
 */

type Props = {
  initial: Release[];
  chunkCount: number;
  total: number;
  perChunk: number;
  /** Every release at spectrum resolution, newest first. */
  pulse: ReleasePulse[];
  /** Which chunk each anchor lives in. See `use-release-archive.ts`. */
  chunkByAnchor: Record<string, number>;
};

function YearMarker({ year }: { year: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-rule bg-foreground/[0.015] px-5 py-2.5 sm:px-9">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        {year}
      </span>
      <span aria-hidden className="h-px flex-1 bg-rule" />
    </div>
  );
}

export function ChangelogFeed({
  initial,
  chunkCount,
  total,
  perChunk,
  pulse,
  chunkByAnchor,
}: Props) {
  const { releases, loadedChunks, status, loadThrough, jumpTo } =
    useReleaseArchive({ initial, chunkByAnchor });

  const sentinelRef = useRef<HTMLDivElement>(null);
  const { activeAnchor, pinned } = useActiveRelease(
    sentinelRef,
    releases.length,
    initial[0]?.anchor ?? null,
  );

  let previousYear = '';

  return (
    <>
      <div className="border-b border-rule px-5 pb-6 pt-7 sm:px-9 sm:pb-7">
        <ReleaseSpectrum
          pulse={pulse}
          activeAnchor={activeAnchor}
          onSelect={jumpTo}
        />
      </div>
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/*
        The history, pinned.

        ── Why `fixed` and not `sticky` ───────────────────────────────────────

        `sticky` was the obvious choice and it is the wrong one, because a
        sticky element keeps its place in normal flow whether it is stuck or
        not. Hidden, it left fifty-two pixels of blank between the band and the
        first release; collapsed to nothing, the page jumped by fifty-two pixels
        at the exact moment it pinned, because that flow space appears above the
        viewport and everything below it moves down. There is no third option
        with `sticky`: reserving the space and not reserving it are the only
        two states, and both are wrong.

        `fixed` reserves nothing, so neither happens.

        What `fixed` costs is the frame: it spans the window rather than the
        ruled column. The inner wrapper below buys that back by repeating the
        page's own measure and padding, so the strip's columns land directly
        under the band's. The full-bleed rule and blur behind it are a gain
        rather than a compromise. Pinned, it reads as a toolbar under the
        navbar, which is what it is.

        `pointer-events-none` while hidden keeps an invisible bar from
        swallowing clicks on the release underneath it.
      */}
      <div
        className={[
          'fixed inset-x-0 top-[var(--nextra-navbar-height,4rem)] z-20 border-b border-rule bg-background/88 backdrop-blur transition-[opacity,transform] duration-200',
          pinned
            ? 'opacity-100'
            : 'pointer-events-none -translate-y-1 opacity-0',
        ].join(' ')}
      >
        {/* The page's measure, repeated: `max-w-[76rem] px-4 sm:px-6` is the
            outer container in `page.tsx` and `px-5 sm:px-9` is the padding
            every band inside the frame uses. Together they put this drawing on
            the same left edge as the one in the header. */}
        <div className="mx-auto w-full max-w-[76rem] px-4 sm:px-6">
          <div className="px-5 sm:px-9">
            <ReleaseSpectrum
              pulse={pulse}
              activeAnchor={activeAnchor}
              onSelect={jumpTo}
              variant="strip"
            />
          </div>
        </div>
      </div>

      <div>
        {releases.map((release, index) => {
          const year = release.date.slice(0, 4);
          const startsYear = year !== previousYear;
          previousYear = year;

          return (
            <div
              key={release.anchor}
              // Only the entries that arrived after the page did. The first ten
              // are already on screen when the animation would run, and fading
              // them in would just delay the page for no one's benefit.
              className={
                index >= initial.length ? 'changelog-enter' : undefined
              }
            >
              {startsYear && <YearMarker year={year} />}
              <ReleaseArticle release={release} />
            </div>
          );
        })}
      </div>

      <ArchiveFooter
        loaded={releases.length}
        total={total}
        nextBatch={Math.min(perChunk, total - releases.length)}
        status={status}
        hasMore={loadedChunks < chunkCount}
        onLoadMore={() => void loadThrough(loadedChunks + 1)}
      />
    </>
  );
}
