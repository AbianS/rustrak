import type { Metadata } from 'next';
import { PostEntry } from '@/components/blog/post-list';
import { getPosts, getTagCounts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Updates, releases, and engineering notes from the Rustrak project.',
};

/**
 * The blog index, in the same ruled frame as the changelog.
 *
 * The frame is what keeps a three-post blog from looking like an unfinished
 * page, but it only works if the frame is filled, and it was not. The masthead
 * set a 72px headline in the left half of a 72rem cell with nothing in the
 * right, then handed the newest post a band three times the height of the two
 * under it. A wide page with one left-aligned column is not a layout, it is a
 * narrow page with a large right margin.
 *
 * Two changes fix it, and neither is decoration. The header runs title and lead
 * side by side and closes on a band of the tags actually in use, which is the
 * only navigation a blog this size can honestly offer. And every post gets the
 * same block, filled with its own outline: see `post-list.tsx`.
 */
export default function BlogPage() {
  const posts = getPosts();
  const tags = getTagCounts();

  return (
    <div className="blog-root mx-auto w-full max-w-[76rem] px-4 py-10 sm:px-6 sm:py-14">
      <div className="overflow-x-clip border-x border-t border-rule">
        <header className="px-5 py-14 sm:px-9 sm:py-16 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end lg:gap-x-12">
          <div>
            <span className="eyebrow">Blog</span>
            {/* `display-lg`, not `display-xl`. At the top size the headline was
                a poster over a list of three links; a step down puts it in
                proportion to what is under it, which is the entire point of a
                masthead. */}
            {/* No measure cap. The grid track already bounds this, and a `ch`
                cap on a five-word headline only ever finds a place to break it
                that the track would not have: at 14ch it set "Notes from
                building" and left "it." alone on a second line. */}
            <h1 className="display-lg mt-5 text-foreground">
              Notes from building it.
            </h1>
          </div>
          <p className="mt-6 max-w-[52ch] text-[15.5px] leading-relaxed text-muted-foreground lg:mt-0">
            Release announcements, and the longer write-ups of how a piece of
            Rustrak actually works once it is finished.
          </p>
        </header>

        {/*
          The subjects, with how much has been written about each. It is a
          reading of the archive rather than a filter: three posts do not need
          filtering, and a control that narrows a list of three to a list of two
          is a worse page than the one it replaced. What it does do is say what
          this blog is about without a paragraph claiming it, and it grows into
          real navigation on its own as posts accumulate.
        */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-y border-rule px-5 py-4 sm:px-9">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground/70">
              Subjects
            </span>
            {tags.map(({ tag, count }) => (
              <span
                key={tag}
                className="font-mono text-[12px] text-muted-foreground"
              >
                {tag}
                <span className="ml-1.5 tabular-nums text-muted-foreground/45">
                  {count}
                </span>
              </span>
            ))}
          </div>
        )}

        {posts.length > 0 ? (
          posts.map((post, index) => (
            <PostEntry
              key={post.slug}
              post={post}
              index={index + 1}
              latest={index === 0}
            />
          ))
        ) : (
          <p className="border-b border-rule px-5 py-16 text-center text-[15px] text-muted-foreground sm:px-9">
            No posts yet. Check back soon.
          </p>
        )}
      </div>
    </div>
  );
}
