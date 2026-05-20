import type { Metadata } from 'next';
import { BlogLayoutClient } from './blog-layout-client';

export const metadata: Metadata = {
  title: {
    default: 'Blog',
    template: '%s — Rustrak Blog',
  },
  description:
    'Updates, releases, and engineering notes from the Rustrak project.',
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BlogLayoutClient />
      <div className="blog-section min-h-screen w-full">{children}</div>
    </>
  );
}
