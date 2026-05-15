import { Geist, Geist_Mono } from 'next/font/google';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { RustrakLogoIcon } from '@/components/icons/rustrak-logo';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: {
    default: 'Rustrak Documentation',
    template: '%s - Rustrak',
  },
  description: 'Self-hosted error tracking compatible with Sentry SDKs',
};

const logo = (
  <span className="flex items-center gap-2 font-bold">
    <RustrakLogoIcon className="size-6" />
    <span className="text-sm font-extrabold tracking-tight uppercase">
      Rustrak
    </span>
  </span>
);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageMap = await getPageMap();

  return (
    <html lang="en" suppressHydrationWarning>
      <Head faviconGlyph="R" />
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <Layout
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/AbianS/rustrak/tree/main/apps/docs"
          navbar={
            <Navbar
              logo={logo}
              projectLink="https://github.com/AbianS/rustrak"
            />
          }
          footer={<Footer>GPL-3.0 {new Date().getFullYear()} Rustrak</Footer>}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
