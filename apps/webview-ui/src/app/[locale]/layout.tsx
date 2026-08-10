import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
// Self-hosted fallback for the mono stack: `next/font/google` cannot reach
// Google Fonts on air-gapped machines, and the fallback names below only work
// when the browser can actually resolve them. This registers
// `JetBrains Mono Variable` locally so the offline path has a real font to
// paint with instead of a generic one.
import '@fontsource-variable/jetbrains-mono';
import { NextIntlClientProvider } from 'next-intl';
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from '@/shared/ui/components/theme-provider';
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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
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

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <main className="flex-1">{children}</main>
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
