import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
// Self-hosted fallback for the mono stack: `next/font/google` cannot reach
// Google Fonts on air-gapped machines, and the fallback names below only work
// when the browser can actually resolve them. This registers
// `JetBrains Mono Variable` locally so the offline path has a real font to
// paint with instead of a generic one.
import '@fontsource-variable/jetbrains-mono';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { pickMessages, SHELL_NAMESPACES } from '@/shared/i18n/client-messages';
import { routing } from '@/shared/i18n/routing';
import { ThemeProvider } from '@/shared/ui/components/theme-provider';
import { TimeZoneCookie } from '@/shared/ui/components/time-zone-cookie';
import { Toaster } from '@/shared/ui/components/toaster';
import '../globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  // A JetBrains Sans install (or a future self-hosted copy) takes over while
  // Google Fonts is slow or unreachable. The browser falls back per-font,
  // so a slow webfont paints with the next resolvable face immediately.
  fallback: ['JetBrains Sans'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  fallback: ['JetBrains Mono Variable'],
});

/**
 * No `generateStaticParams`.
 *
 * It was here, and it promised something this app cannot deliver: every route
 * under `(main)` builds its client from the request's session cookie, so the
 * build marks all 32 of them dynamic no matter what this exports. Declaring the
 * params bought no prerendering and cost the reader the belief that pages were
 * static, which is how the two `setRequestLocale` omissions below went
 * unnoticed for a whole phase.
 *
 * If a genuinely static page ever appears here, the docs' full static-rendering
 * setup comes back with it: this export, `setRequestLocale` in that page, and
 * an explicit `locale` in its `generateMetadata`. Half of it is worse than
 * none.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // The locale comes from the segment rather than from the request context.
  // `generateMetadata` runs before the layout body, so nothing has called
  // `setRequestLocale` yet, and an implicit `getTranslations('app')` would read
  // whatever the proxy header happened to say -- or fall back to English on any
  // request that reached this segment without passing the proxy.
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
    namespace: 'app',
  });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // The proxy's matcher has to let static assets through, and it does that by
  // excluding any path containing a dot. That exclusion is not asset-shaped:
  // `/v1.0/auth/login` contains a dot too, so it skipped the proxy, landed here
  // with `locale = 'v1.0'`, and rendered the entire dashboard under
  // `<html lang="v1.0">` with English messages -- one working page per bogus
  // prefix anyone cared to type. The segment is only trustworthy once it has
  // been checked against the routing config.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Nothing here is statically rendered (see `generateMetadata` above), so this
  // is not the docs' static-rendering opt-in. It is what makes the URL segment
  // the authority on the locale: without it every `getTranslations` below reads
  // the proxy's header instead, and a request that reached this segment with a
  // header the proxy never set would render `/zh` in English rather than 404.
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {/* Renders nothing. Writes the reader's timezone to a cookie that
            the next request reads; see the component. */}
        <TimeZoneCookie />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* Only what renders outside `(main)`. The dashboard's own provider
              in `(main)/layout.tsx` widens this; see `client-messages.ts` for
              why the split exists and what it measured. */}
          <NextIntlClientProvider
            messages={pickMessages(messages, SHELL_NAMESPACES)}
          >
            <main className="flex-1">{children}</main>
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
