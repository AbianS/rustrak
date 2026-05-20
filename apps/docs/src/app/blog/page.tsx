import type { Metadata } from 'next';
import { PostCard } from '@/components/blog/post-card';
import { getPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Updates, releases, and engineering notes from the Rustrak project.',
};

export default function BlogPage() {
  const posts = getPosts();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3">
          Blog
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Updates, releases, and engineering notes from the Rustrak project.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="text-neutral-500 dark:text-neutral-400 py-16 text-center">
          No posts yet. Check back soon.
        </p>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
