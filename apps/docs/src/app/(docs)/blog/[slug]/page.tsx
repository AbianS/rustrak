import { notFound } from 'next/navigation';
import { importPage } from 'nextra/pages';
import { MermaidFit } from '@/components/blog/mermaid-fit';
import { PostHeader } from '@/components/blog/post-header';
import { PostNeighbours } from '@/components/blog/post-neighbours';
import { ReadingRail, type TocItem } from '@/components/blog/reading-rail';
import { getNeighbourPosts, getPost, getPosts } from '@/lib/blog';

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

/** The element the reading progress is measured against. */
const BODY_ID = 'post-body';

/**
 * A post.
 *
 * The content still goes through Nextra: unlike the changelog, posts carry
 * fenced code, and `importPage` is what gives them highlighting, a copy button
 * and — the reason it matters here — the heading ids and `toc` the rail beside
 * the text is built from. There is nothing to gain by rendering them by hand.
 *
 * The layout is two columns that become one: the text in a measured column and
 * the contents pinned beside it, collapsing to the text alone below `lg`. The
 * rail's own cell stays in the tree at every width even when its list is
 * hidden, because the progress bar lives in the same component and a phone
 * wants that as much as a desktop does.
 */
export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const result = getPost(slug);
  if (!result) notFound();

  const { post } = result;
  const { older, newer } = getNeighbourPosts(slug);

  let MDXContent: React.ComponentType;
  let toc: TocItem[] = [];
  try {
    const imported = await importPage(['blog', slug]);
    MDXContent = imported.default;
    // Third-level headings and deeper would turn the rail into an outline of
    // an outline; two levels is what fits beside the text without scrolling.
    toc = imported.toc.filter((item) => item.depth <= 3);
  } catch {
    notFound();
  }

  return (
    <div className="blog-root mx-auto w-full max-w-[76rem] px-4 py-10 sm:px-6 sm:py-14">
      {/*
        `overflow-x-clip`, the same backstop the landing's frame carries: a
        grid item's `min-width` is `auto`, so one wide child — a Mermaid
        diagram at its natural 1530px, a long line in a code block — widens
        the track, then the frame, then the document, and the whole page
        slides sideways on a phone. The children below cap themselves with
        `min-w-0`; this guarantees a mistake stays inside the frame. */}
      <div className="overflow-x-clip border-x border-t border-rule">
        <PostHeader post={post} />

        {/*
          The rule closes on the wrapper, not on the two cells: below `lg` the
          rail's cell is empty and unpadded, so a border of its own would draw
          a stray hairline under the text with nothing between the two.

          And there is deliberately no rule *between* them either. With the
          frame's two edges already drawn, a divider here plus a bar down the
          contents list put four vertical lines in the right half of the page,
          which read as a table rather than as a page. White space separates
          the two columns now, and the rail marks its active item with a dot
          instead of a bar — see `reading-rail.tsx`.
        */}
        {/*
          The padding sits on the grid rather than on the two cells, and that
          is what makes this the same grid as the masthead above it. With the
          article carrying its own `px-9` the text track was 36px wider than
          the header's and the rail started 36px further left, so the byline
          and the contents list did not line up with each other and neither
          lined up with the title. One padded container and one `gap-x-10`,
          repeated in both places, and the page is two columns from top to
          bottom.
        */}
        <div className="grid border-b border-rule px-5 sm:px-9 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-x-10">
          <article id={BODY_ID} className="blog-prose min-w-0 py-12 sm:py-14">
            <MDXContent />
            <MermaidFit bodyId={BODY_ID} />
          </article>

          <div className="min-w-0 lg:py-14">
            <ReadingRail items={toc} bodyId={BODY_ID} />
          </div>
        </div>

        <PostNeighbours older={older} newer={newer} />
      </div>
    </div>
  );
}
