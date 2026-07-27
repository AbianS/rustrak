import Link from 'next/link';
import { formatDate, type Post } from '@/lib/blog';

/**
 * What to read next, at the foot of a post.
 *
 * Labelled "older" and "newer" rather than "previous" and "next": on a page
 * that is itself an entry in a reverse-chronological list, "next" is genuinely
 * ambiguous, and the reader should not have to work out which direction the
 * arrow means.
 */
function NeighbourCell({
  post,
  label,
  align,
}: {
  post: Post;
  label: string;
  align: 'left' | 'right';
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={[
        'group flex flex-col gap-2 px-5 py-8 transition-colors hover:bg-foreground/[0.015] sm:px-9',
        align === 'right' ? 'sm:items-end sm:text-right' : '',
      ].join(' ')}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {align === 'left' && <span aria-hidden>← </span>}
        {label}
        {align === 'right' && <span aria-hidden> →</span>}
      </span>
      <span className="text-[15px] font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
        {post.title}
      </span>
      <time
        dateTime={post.date}
        className="font-mono text-[11px] text-muted-foreground"
      >
        {formatDate(post.date)}
      </time>
    </Link>
  );
}

export function PostNeighbours({
  older,
  newer,
}: {
  older: Post | null;
  newer: Post | null;
}) {
  if (!older && !newer) return null;

  return (
    <nav
      aria-label="More posts"
      className="grid border-b border-rule sm:grid-cols-2"
    >
      {older && (
        <div className={newer ? 'border-b border-rule sm:border-b-0' : ''}>
          <NeighbourCell post={older} label="Older post" align="left" />
        </div>
      )}
      {newer && (
        // The rule sits on the newer cell rather than on the older one so it
        // is still drawn when this is the oldest post and the left cell is
        // absent — a divider belongs to the pair, not to one side of it.
        <div
          className={older ? 'sm:border-l sm:border-rule' : 'sm:col-start-2'}
        >
          <NeighbourCell post={newer} label="Newer post" align="right" />
        </div>
      )}
    </nav>
  );
}
