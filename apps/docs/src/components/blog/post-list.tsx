import Link from 'next/link';
import {
  formatDate,
  formatDateShort,
  type Post,
  shortReadingTime,
} from '@/lib/blog';
import { TagPill } from './tag-pill';

/**
 * The index of the blog: one post given room, the rest given a line each.
 *
 * The split is the point. A list where every entry is the same size makes the
 * reader compare three headlines and pick one, which is work; leading with the
 * newest post and its full standfirst answers "is there anything new here"
 * before they have to. The rows below stay deliberately terse — a date, a
 * title, its tags — because that is all a reader needs to recognise a post
 * they have already read and skip it.
 */

function MetaDot() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      ·
    </span>
  );
}

/**
 * One track for the body and a 16rem track for everything about it.
 *
 * The aside is the same width as the contents rail on a post, and starts at
 * the same x. That is the whole reason the wide frame works: a page this wide
 * with one left-aligned column of text is not a layout, it is a narrow page
 * with a large right margin — which is what this looked like when the frame
 * grew and nothing else moved.
 */
const TRACKS = 'lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-10';

export function FeaturedPost({ post }: { post: Post }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group block border-b border-rule px-5 py-12 transition-colors hover:bg-foreground/[0.015] sm:px-9 sm:py-16 ${TRACKS}`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="text-primary">Latest</span>
          <MetaDot />
          <time dateTime={post.date}>{formatDate(post.date)}</time>
        </div>

        <h2 className="display-lg mt-5 text-foreground transition-colors group-hover:text-primary">
          {post.title}
        </h2>

        {post.description && (
          <p className="mt-5 max-w-[62ch] text-[15.5px] leading-relaxed text-muted-foreground">
            {post.description}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 lg:mt-1 lg:flex-col lg:items-start lg:gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {shortReadingTime(post.readingTime)}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {post.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
        <span
          aria-hidden
          className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-primary lg:mt-2 lg:block"
        >
          Read →
        </span>
      </div>
    </Link>
  );
}

export function PostRow({ post }: { post: Post }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block border-b border-rule px-5 py-7 transition-colors hover:bg-foreground/[0.015] sm:px-9 sm:py-8 lg:grid lg:grid-cols-[5.5rem_minmax(0,1fr)_16rem] lg:items-baseline lg:gap-10"
    >
      {/*
        The date column is fixed width and monospaced so every row's title
        starts at the same x. That single alignment is what turns a stack of
        links into a list you can run your eye down.
      */}
      <div className="flex items-baseline gap-3 font-mono text-[11.5px] tabular-nums text-muted-foreground lg:flex-col lg:gap-1">
        <time dateTime={post.date}>{formatDateShort(post.date)}</time>
        <span className="text-muted-foreground/70 lg:hidden">
          {shortReadingTime(post.readingTime)}
        </span>
      </div>

      <div className="mt-3 min-w-0 lg:mt-0">
        <h3 className="text-[17.5px] font-medium leading-snug tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
          {post.title}
        </h3>
        {/* The standfirst is what earns the row its width. Without it a wide
            frame leaves a title stranded in the middle of an empty band; with
            it the row says enough to decide on, and still stops at two lines
            so the list keeps its rhythm. */}
        {post.description && (
          <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">
            {post.description}
          </p>
        )}
      </div>

      {/* The same track the featured cell and the post rail use. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0 lg:flex-col lg:items-start lg:gap-2.5">
        <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground lg:block">
          {shortReadingTime(post.readingTime)}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {post.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
      </div>
    </Link>
  );
}
