import { getPageMap } from 'nextra/page-map';
import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { RustrakLogoIcon } from '@/components/icons/rustrak-logo';

/**
 * The documentation shell: navbar, sidebar, search, table of contents, footer.
 *
 * This used to be the root layout, which meant it wrapped every route in the
 * app — including the landing, which uses none of it. A visitor arriving at `/`
 * was downloading and hydrating a documentation theme to look at a marketing
 * page, and the landing was then spending three blocks of CSS in `globals.css`
 * undoing the layout it had been given (the prose width cap, the trailing
 * "last updated" spacer, the content width variable). All of that is gone: the
 * landing is a sibling route now and simply never enters this tree.
 *
 * `getPageMap()` moving here matters as much as the theme did. It is the whole
 * navigable structure of the docs, serialised into the payload of whatever
 * renders it — and it was being serialised into the landing's HTML too, for a
 * page with no sidebar to put it in.
 *
 * This is a route group, so `(docs)` contributes nothing to any URL. Everything
 * inside keeps the path it always had.
 */

const logo = (
  <span className="flex items-center gap-2 font-bold">
    <RustrakLogoIcon className="size-6" />
    <span className="text-sm font-extrabold tracking-tight uppercase">
      Rustrak
    </span>
  </span>
);

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageMap = await getPageMap();

  return (
    <Layout
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/AbianS/rustrak/tree/main/apps/docs"
      navbar={
        <Navbar logo={logo} projectLink="https://github.com/AbianS/rustrak" />
      }
      footer={<Footer>GPL-3.0 {new Date().getFullYear()} Rustrak</Footer>}
    >
      {children}
    </Layout>
  );
}
