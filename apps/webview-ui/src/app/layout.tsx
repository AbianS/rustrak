import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/features/user/api/queries';
import { TimeZoneSync } from '@/features/user/ui/components/time-zone-sync';
import { pickMessages, SHELL_NAMESPACES } from '@/shared/i18n/client-messages';
import { ThemeProvider } from '@/shared/ui/components/theme-provider';
import { Toaster } from '@/shared/ui/components/toaster';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  // No explicit locale needed any more. `getRequestConfig` resolves it from the
  // reader rather than from a URL segment, so there is no earlier-than-the-body
  // ordering problem for this to work around.
  const t = await getTranslations('app');

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolved from the reader, not from the URL. There is no `[locale]` segment
  // to validate and no bogus value to guard against: `getRequestConfig` only
  // ever returns a locale this app has messages for.
  const [locale, messages, session] = await Promise.all([
    getLocale(),
    getMessages(),
    getCurrentUser(),
  ]);
  const hasTimeZone =
    session.state === 'authenticated' && Boolean(session.user.timezone);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {/* Renders nothing. Adopts the browser's timezone onto the account
            the first time a reader arrives without one; see the component. */}
        <TimeZoneSync hasTimeZone={hasTimeZone} />
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
