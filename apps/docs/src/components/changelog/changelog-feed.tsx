'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Release, ReleaseChunk } from '@/lib/release';
import { ReleaseArticle } from './release-article';

/**
 * The feed, and the only client code on the page.
 *
 * It exists for one reason: the page ships the ten most recent releases and
 * nothing else, and something has to be able to go and get the rest. Older
 * releases are fetched a chunk at a time from static JSON generated at build
 * time (`app/(docs)/changelog/releases/[chunk]/route.ts`), which keeps the
 * first response the same size in two years as it is today.
 *
 * The reveal is therefore a real fetch, not a stack of hidden markup with a
 * button over it. That distinction is the entire exercise — hiding it in CSS
 * would have left all 604KB in the document and only moved the scrollbar.
 */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type Props = {
  initial: Release[];
  chunkCount: number;
  total: number;
  perChunk: number;
  /**
   * Which chunk every anchor lives in, including the legacy filename anchors,
   * so a deep link into a release that has not been fetched yet can pull the
   * chunks it needs instead of landing on the wrong entry.
   */
  chunkByAnchor: Record<string, number>;
};

type Status = 'idle' | 'loading' | 'error';

function YearMarker({ year }: { year: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-rule bg-foreground/[0.015] px-5 py-3 sm:px-9">
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
  chunkByAnchor,
}: Props) {
  const [releases, setReleases] = useState<Release[]>(initial);
  const [loadedChunks, setLoadedChunks] = useState(1);
  const [status, setStatus] = useState<Status>('idle');
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);

  // Mirrors of the two values the async loop reads between awaits. State would
  // be stale inside the loop and would also make `loadThrough` a new function
  // on every render, which the hash listener below depends on it not being.
  const loadedRef = useRef(1);
  const busyRef = useRef(false);

  const loadThrough = useCallback(async (target: number) => {
    if (busyRef.current || target <= loadedRef.current) return;
    busyRef.current = true;
    setStatus('loading');

    try {
      for (let chunk = loadedRef.current + 1; chunk <= target; chunk += 1) {
        const response = await fetch(
          `${BASE_PATH}/changelog/releases/${chunk}`,
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as ReleaseChunk;

        // Appended per chunk rather than once at the end: a failure on the
        // third request should keep the two that succeeded on the page.
        loadedRef.current = chunk;
        setReleases((current) => [...current, ...payload.releases]);
        setLoadedChunks(chunk);
      }
      setStatus('idle');
    } catch {
      setStatus('error');
    } finally {
      busyRef.current = false;
    }
  }, []);

  /**
   * Deep links. Every release used to be in the document, so any `#v0-4-1`
   * shared before today has to keep working — including the ones that point
   * into a chunk this page has not fetched. The browser has already given up
   * on an unknown hash by the time this runs, so the chunk is pulled and the
   * scroll is done by hand once the entry exists.
   */
  useEffect(() => {
    const resolve = () => {
      const anchor = decodeURIComponent(window.location.hash.slice(1));
      if (!anchor) return;

      const chunk = chunkByAnchor[anchor];
      if (!chunk || chunk <= loadedRef.current) return;

      setPendingAnchor(anchor);
      void loadThrough(chunk);
    };

    resolve();
    window.addEventListener('hashchange', resolve);
    return () => window.removeEventListener('hashchange', resolve);
  }, [chunkByAnchor, loadThrough]);

  /** Scrolls once the release the hash asked for is actually in the DOM. */
  useEffect(() => {
    if (!pendingAnchor) return;
    const target = document.getElementById(pendingAnchor);
    if (!target) return;
    target.scrollIntoView();
    setPendingAnchor(null);
  }, [pendingAnchor, releases]);

  const remaining = total - releases.length;
  const nextBatch = Math.min(perChunk, remaining);
  const hasMore = loadedChunks < chunkCount;

  let previousYear = '';

  return (
    <>
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

      {hasMore ? (
        <div className="border-b border-rule px-5 py-10 text-center sm:px-9">
          <button
            type="button"
            onClick={() => void loadThrough(loadedChunks + 1)}
            disabled={status === 'loading'}
            className="inline-flex items-center gap-2 rounded-full border border-rule px-5 py-2.5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-wait disabled:opacity-60"
          >
            {status === 'loading' ? (
              <>
                <span
                  aria-hidden
                  className="size-1.5 animate-pulse rounded-full bg-primary"
                />
                Loading
              </>
            ) : status === 'error' ? (
              'Retry'
            ) : (
              `Show ${nextBatch} earlier release${nextBatch === 1 ? '' : 's'}`
            )}
          </button>

          <p
            className="mt-3.5 font-mono text-[11px] tabular-nums text-muted-foreground"
            aria-live="polite"
          >
            {status === 'error'
              ? 'Could not reach the archive.'
              : `${releases.length} of ${total} releases`}
          </p>

          <noscript>
            <p className="mt-3.5 text-[13px] text-muted-foreground">
              The remaining {remaining} releases load on demand and need
              JavaScript. They are also on{' '}
              <a
                className="underline underline-offset-2 hover:text-primary"
                href="https://github.com/AbianS/rustrak/releases"
              >
                GitHub Releases
              </a>
              .
            </p>
          </noscript>
        </div>
      ) : (
        <div className="border-b border-rule px-5 py-10 text-center sm:px-9">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            The first release
          </p>
        </div>
      )}
    </>
  );
}
