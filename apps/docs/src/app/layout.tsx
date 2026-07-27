import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import { Head } from 'nextra/components';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Display accent, used only on the landing: one or two words per headline set
// in italic serif at the same size as the surrounding sans. The texture change
// is what keeps the big type from reading as another dev-tool template.
const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
});

export const metadata = {
  title: {
    default: 'Rustrak Documentation',
    template: '%s - Rustrak',
  },
  description: 'Self-hosted error tracking compatible with Sentry SDKs',
};

/**
 * The document, and nothing else.
 *
 * This used to also be the documentation shell — `getPageMap()`, the theme's
 * `<Layout>`, the navbar and the footer all lived here, which meant every route
 * got them whether it wanted them or not. They have moved to `(docs)/layout`,
 * so the landing no longer carries a documentation theme it does not render.
 *
 * Nextra's `<Head>` stays. It has to be a direct child of `<html>` because it
 * renders a literal `<head>`, and unlike the theme it is genuinely shared: a
 * `<style>` block defining the `--nextra-*` custom properties, the two
 * `theme-color` metas and the favicon. Both halves of the site want all four.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Head faviconGlyph="R" />
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
