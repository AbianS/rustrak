import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Suspense } from 'react';
import { getCurrentUser } from '@/features/user/api/queries';
import { Header } from '@/features/user/ui/components/header';
import { MAIN_NAMESPACES, pickMessages } from '@/shared/i18n/client-messages';
import { OutageScreen } from '@/shared/ui/components/outage-screen';
import { UpdateBannerSlot } from '@/shared/ui/components/update-banner-slot';
import { CommandBarSlot } from './_components/command-bar-slot';

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentUser();

  // The root gate for the whole authenticated app, so this is the branch a
  // wrong conversion turns into a login loop. `anonymous` is the only state
  // that redirects; `unavailable` renders instead, and deliberately does not
  // render `children`, because every page below assumes it has a user.
  if (session.state === 'anonymous') {
    return redirect('/auth/login');
  }

  // Returned bare, with no wrapper: this is the one branch that renders no
  // `Header`, so the screen owns the whole viewport and brings its own brand.
  if (session.state === 'unavailable') {
    return <OutageScreen error={session.error} />;
  }

  const messages = await getMessages();

  return (
    // Widens the shell's provider to the dashboard's namespaces. It passes the
    // union rather than a delta because next-intl treats `messages` as atomic:
    // a nested provider replaces the inherited value instead of merging into
    // it. Everything above `(main)` -- the login and the invitation, the two
    // pages a visitor reaches before they are anyone -- keeps the small set.
    <NextIntlClientProvider messages={pickMessages(messages, MAIN_NAMESPACES)}>
      <div className="min-h-screen flex flex-col">
        <Header
          user={session.user}
          commandBar={
            /* Streamed so the projects read never delays the header itself. */
            <Suspense fallback={null}>
              <CommandBarSlot />
            </Suspense>
          }
        />
        <main className="flex-1">{children}</main>
        {/* Streamed separately so the feed fetch never holds up the page: the
            banner is fixed-positioned, so arriving late shifts nothing. */}
        <Suspense fallback={null}>
          <UpdateBannerSlot />
        </Suspense>
      </div>
    </NextIntlClientProvider>
  );
}
