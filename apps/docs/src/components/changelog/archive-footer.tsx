'use client';

import type { ArchiveStatus } from './use-release-archive';

/**
 * The end of the feed: either the way to the rest of the archive, or the note
 * that there is no rest.
 *
 * The `noscript` is not ceremony. Everything below the tenth release is fetched
 * (see `use-release-archive.ts`), so with scripting off this page genuinely is
 * ten releases and the reader deserves to be told where the other thirty-one
 * are rather than left to conclude the project started this year.
 */
export function ArchiveFooter({
  loaded,
  total,
  nextBatch,
  status,
  hasMore,
  onLoadMore,
}: {
  loaded: number;
  total: number;
  nextBatch: number;
  status: ArchiveStatus;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (!hasMore) {
    return (
      <div className="border-b border-rule px-5 py-10 text-center sm:px-9">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          The first release
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-rule px-5 py-10 text-center sm:px-9">
      <button
        type="button"
        onClick={onLoadMore}
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
          : `${loaded} of ${total} releases`}
      </p>

      <noscript>
        <p className="mt-3.5 text-[13px] text-muted-foreground">
          The remaining {total - loaded} releases load on demand and need
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
  );
}
