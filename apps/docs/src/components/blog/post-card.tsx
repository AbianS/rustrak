import Link from 'next/link';
import type { Post } from '@/lib/blog';
import { formatDate } from '@/lib/blog';
import { TagPill } from './tag-pill';

type PostCardProps = {
  post: Post;
};

export function PostCard({ post }: PostCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block py-8 border-b border-neutral-200 dark:border-neutral-800 last:border-0"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-sm text-neutral-500 dark:text-neutral-400">
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <span aria-hidden>·</span>
        <span>{post.readingTime}</span>
        {post.author && (
          <>
            <span aria-hidden>·</span>
            <span>{post.author}</span>
          </>
        )}
      </div>

      <h2 className="text-xl font-bold tracking-tight mb-2 text-neutral-900 dark:text-neutral-100 group-hover:text-primary transition-colors duration-150">
        {post.title}
      </h2>

      {post.description && (
        <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed line-clamp-2 mb-4">
          {post.description}
        </p>
      )}

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
      )}
    </Link>
  );
}
