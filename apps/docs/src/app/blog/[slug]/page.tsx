import { notFound } from 'next/navigation';
import { importPage } from 'nextra/pages';
import { PostHeader } from '@/components/blog/post-header';
import { getPost, getPosts } from '@/lib/blog';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const result = getPost(slug);
  if (!result) return {};
  const { post } = result;
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
      ...(post.image ? { images: [{ url: post.image }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const result = getPost(slug);
  if (!result) notFound();

  const { post } = result;

  let MDXContent: React.ComponentType;
  try {
    const imported = await importPage(['blog', slug]);
    MDXContent = imported.default;
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PostHeader post={post} />
      <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-code:font-mono">
        <MDXContent />
      </article>

      <footer className="mt-16 pt-8 border-t border-neutral-200 dark:border-neutral-800">
        <a
          href="/blog"
          className="text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-primary transition-colors"
        >
          ← Back to Blog
        </a>
      </footer>
    </div>
  );
}
