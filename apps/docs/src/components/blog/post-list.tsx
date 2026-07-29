import Link from 'next/link';
import { formatDateShort, type Post, shortReadingTime } from '@/lib/blog';
import { TagPill } from './tag-pill';

/**
 * The index of the blog: one entry per post, all the same shape, each showing
 * what is actually inside it.
 *
 * ── What changed, and why ──────────────────────────────────────────────────
 *
 * This used to lead with the newest post at three times the size of the others
 * and give the rest a line each. The argument for that was that a reader should
 * not have to compare three headlines. The argument against it, which is the
 * one that won, is that there are three posts: singling one out does not
 * promote it so much as demote the other two, and the page read as one article
 * with a couple of related links under it rather than as a body of work.
 *
 * So every post is now the same block, and what fills that block is its own
 * outline. That is the whole idea here. A standfirst tells you what a piece is
 * about; its section titles tell you what is in it, which is the thing a reader
 * of a four-thousand-word engineering post actually wants to know before
 * committing eight minutes. It also solves the layout problem honestly: this
 * blog has no cover images, so the structure of the writing is the only
 * material available to fill a wide frame with, and it is better material than
 * a photograph would be.
 */

/**
 * How many sections to show before the count takes over.
 *
 * Five is roughly where a list stops being a shape the eye takes in at once and
 * starts being something to read, which would put the index in competition with
 * the posts it is indexing.
 */
const OUTLINE_LIMIT = 5;

export function PostEntry({
  post,
  index,
  latest,
}: {
  post: Post;
  /** One-based, newest first. Drawn as the entry's number in the archive. */
  index: number;
  latest: boolean;
}) {
  const shown = post.outline.slice(0, OUTLINE_LIMIT);
  const hidden = post.outline.length - shown.length;

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block border-b border-rule px-5 py-9 transition-colors hover:bg-foreground/[0.015] sm:px-9 sm:py-11 lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)_16rem] lg:gap-x-10"
    >
      {/*
        The number and the date, in the fixed left track that makes every title
        on the page start at the same x. The numeral is the archive's count
        rather than the post's id: it renumbers as posts are added, and that is
        correct, because what it says is "this is the third most recent piece",
        not "this is post three".
      */}
      <div className="flex items-baseline gap-3 lg:block">
        <span
          aria-hidden
          className="font-mono text-[13px] tabular-nums text-muted-foreground/50"
        >
          {String(index).padStart(2, '0')}
        </span>
        <time
          dateTime={post.date}
          className="font-mono text-[11.5px] tabular-nums text-muted-foreground lg:mt-2 lg:block"
        >
          {formatDateShort(post.date)}
        </time>
      </div>

      <div className="mt-3 min-w-0 lg:mt-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {latest && (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-primary">
              Latest
            </span>
          )}
          <h2 className="text-[1.25rem] font-medium leading-snug tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary sm:text-[1.375rem]">
            {post.title}
          </h2>
        </div>

        {post.description && (
          <p className="mt-2.5 max-w-[62ch] text-[14.5px] leading-relaxed text-muted-foreground">
            {post.description}
          </p>
        )}

        {/*
          The outline. Numbered and ruled the way a changelog section is,
          because it is the same kind of object: a list of what is inside a
          longer document, being scanned rather than read.

          Deliberately not a set of links to the headings. A reader on the index
          has not chosen the post yet, and offering to drop them into its fourth
          section answers a question nobody asked. The job here is to make the
          post legible enough to choose.
        */}
        {shown.length > 0 && (
          <ol className="mt-5 space-y-1.5">
            {shown.map((heading, position) => (
              <li
                key={heading}
                className="flex gap-2.5 text-[13px] leading-snug text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="font-mono tabular-nums text-muted-foreground/45"
                >
                  {String(position + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 transition-colors group-hover:text-foreground/75">
                  {heading}
                </span>
              </li>
            ))}
            {hidden > 0 && (
              // The same flex row with the numeral made invisible rather than a
              // hand-measured indent. A padding guessed at the width of "01"
              // in mono is right until the type size moves, and it was already
              // six pixels off.
              <li className="flex gap-2.5">
                <span
                  aria-hidden
                  className="font-mono text-[13px] tabular-nums text-transparent"
                >
                  00
                </span>
                <span className="font-mono text-[11.5px] leading-snug text-muted-foreground/60">
                  +{hidden} more
                </span>
              </li>
            )}
          </ol>
        )}
      </div>

      {/* The same 16rem track the post's contents rail uses, so the index and a
          post are one grid seen twice rather than two layouts. */}
      <div className="mt-5 flex flex-wrap items-center gap-2 lg:mt-1 lg:flex-col lg:items-start lg:gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {shortReadingTime(post.readingTime)}
          {post.outline.length > 0 && (
            <>
              <span aria-hidden className="px-1.5 text-muted-foreground/40">
                ·
              </span>
              {post.outline.length} parts
            </>
          )}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {post.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>

        <span
          aria-hidden
          className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-primary lg:mt-1 lg:block"
        >
          Read →
        </span>
      </div>
    </Link>
  );
}
