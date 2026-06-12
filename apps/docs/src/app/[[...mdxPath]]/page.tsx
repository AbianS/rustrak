import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents } from '../../../mdx-components';

export async function generateStaticParams() {
  const all = await generateStaticParamsFor('mdxPath')();
  // Blog posts are handled by app/blog/[slug]/page.tsx
  // Changelog posts are handled by app/changelog/page.tsx
  return all.filter(
    (p) => !Array.isArray(p.mdxPath) || (p.mdxPath[0] !== 'blog' && p.mdxPath[0] !== 'changelog'),
  );
}

// Return 404 for paths not in generateStaticParams
export const dynamicParams = false;

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  return metadata;
}

type PageProps = {
  params: Promise<{ mdxPath?: string[] }>;
};

export default async function Page(props: PageProps) {
  const params = await props.params;
  const result = await importPage(params.mdxPath);
  const { default: MDXContent, toc, metadata } = result;
  const Wrapper = useMDXComponents().wrapper;

  return (
    <Wrapper toc={toc} metadata={metadata}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
