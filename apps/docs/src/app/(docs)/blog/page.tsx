import type { Metadata } from 'next';
import { FeaturedPost, PostRow } from '@/components/blog/post-list';
import { getPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Updates, releases, and engineering notes from the Rustrak project.',
};

/**
 * The blog index, drawn in the same ruled frame as the changelog: a header
 * cell, the newest post given its own band, and a row per post after it. The
 * frame is what keeps a three-post blog from looking like an unfinished page —
 * the structure is visible whether or not there is much in it yet.
 */
export default function BlogPage() {
  const posts = getPosts();
  const [latest, ...rest] = posts;

  return (
    <div className="blog-root mx-auto w-full max-w-[72rem] px-4 py-10 sm:px-6 sm:py-14">
      <div className="overflow-x-clip border-x border-t border-rule">
        {/*
          The masthead is set at the display scale's top size rather than one
          below it. On a 72rem frame the smaller size left the title sitting in
          the left third with nothing to the right of it, which is the failure
          this whole page had: width taken and not used.
        */}
        <header className="border-b border-rule px-5 py-14 sm:px-9 sm:py-20">
          <span className="eyebrow">Blog</span>
          <h1 className="display-xl mt-6 text-foreground">
            Notes from building it.
          </h1>
          <p className="mt-6 max-w-[56ch] text-[15.5px] leading-relaxed text-muted-foreground">
            Release announcements, and the longer write-ups of how a piece of
            Rustrak actually works once it is finished.
          </p>
        </header>

        {latest ? (
          <>
            <FeaturedPost post={latest} />
            {rest.map((post) => (
              <PostRow key={post.slug} post={post} />
            ))}
          </>
        ) : (
          <p className="border-b border-rule px-5 py-16 text-center text-[15px] text-muted-foreground sm:px-9">
            No posts yet. Check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
