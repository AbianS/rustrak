import Link from 'next/link';
import { formatDate, type Post, shortReadingTime } from '@/lib/blog';
import { TagPill } from './tag-pill';

type PostHeaderProps = {
  post: Post;
};

/**
 * The head of a post: a way back, what it is about, and who wrote it when.
 *
 * ── Why it is two tracks ───────────────────────────────────────────────────
 *
 * Everything here used to stack down the left: back link, tags, title,
 * standfirst, byline, one under the next, in the left half of a frame the body
 * underneath spans in two columns. So the page changed shape at the point where
 * the reading started, and the whole right side of the masthead was empty.
 *
 * It is the body's grid now, one cell early. The title and the standfirst sit
 * in the text track and the metadata sits in the 16rem track the contents rail
 * occupies below, which puts the byline directly above the table of contents
 * and the title directly above the first paragraph. Same two columns, all the
 * way down.
 *
 * The byline keeps the short primary rule the changelog puts beside a figure.
 * It is doing more than decoration: it is the mark that says "this block is
 * metadata, not the first paragraph", and without it the author line reads as
 * the opening sentence of the piece.
 */
export function PostHeader({ post }: PostHeaderProps) {
  return (
    <header className="border-b border-rule px-5 py-12 sm:px-9 sm:py-14 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-x-10">
      <div className="min-w-0">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
        >
          <span aria-hidden>←</span>
          Blog
        </Link>

        <h1 className="display-lg mt-7 max-w-[20ch] text-foreground">
          {post.title}
        </h1>

        {post.description && (
          <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-muted-foreground">
            {post.description}
          </p>
        )}
      </div>

      {/*
        Bottom-aligned, so the byline closes on the same line as the standfirst
        rather than floating at the top of a cell taller than it. On a phone the
        tracks collapse and it simply follows the text.
      */}
      <div className="mt-9 lg:mt-0 lg:flex lg:flex-col lg:justify-end">
        <div className="border-l-2 border-primary pl-3">
          <p className="text-[13.5px] font-medium text-foreground">
            {post.author}
          </p>
          <p className="mt-1 font-mono text-[11.5px] tabular-nums text-muted-foreground">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden className="px-1.5 text-muted-foreground/50">
              ·
            </span>
            {shortReadingTime(post.readingTime)}
          </p>
        </div>

        {post.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {post.tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
