import type { Post } from '@/lib/blog';
import { formatDate } from '@/lib/blog';
import { TagPill } from './tag-pill';

type PostHeaderProps = {
  post: Post;
};

export function PostHeader({ post }: PostHeaderProps) {
  return (
    <header className="mb-12 pb-8 border-b border-neutral-200 dark:border-neutral-800">
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
      )}

      <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 mb-4 leading-tight">
        {post.title}
      </h1>

      {post.description && (
        <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">
          {post.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {post.author}
          </span>
        </div>
        <span aria-hidden>·</span>
        <time dateTime={post.date}>{formatDate(post.date)}</time>
        <span aria-hidden>·</span>
        <span>{post.readingTime}</span>
      </div>
    </header>
  );
}
