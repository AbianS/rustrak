import Link from 'next/link';
import { formatDate, type Post, shortReadingTime } from '@/lib/blog';
import { TagPill } from './tag-pill';

type PostHeaderProps = {
  post: Post;
};

/**
 * The head of a post: a way back, what it is about, and who wrote it when.
 *
 * The byline carries the same short primary rule the changelog puts beside a
 * figure, which is doing more than decoration here — it is the mark that says
 * "this block is metadata, not the first paragraph", and without it the author
 * line reads as the opening sentence of the piece.
 */
export function PostHeader({ post }: PostHeaderProps) {
  return (
    <header className="border-b border-rule px-5 py-12 sm:px-9 sm:py-14">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
      >
        <span aria-hidden>←</span>
        Blog
      </Link>

      {post.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {post.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
      )}

      <h1 className="display-lg mt-5 max-w-[24ch] text-foreground">
        {post.title}
      </h1>

      {post.description && (
        <p className="mt-5 max-w-[58ch] text-[16px] leading-relaxed text-muted-foreground">
          {post.description}
        </p>
      )}

      <div className="mt-9 border-l-2 border-primary pl-3">
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
    </header>
  );
}
