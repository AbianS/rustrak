import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@/features/user/api/queries';
import { OutageScreen } from '@/shared/ui/outage-screen';
import { UpdateBannerSlot } from '@/shared/ui/update-banner-slot';
import { Header } from './header';

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
    redirect('/auth/login');
  }

  // Returned bare, with no wrapper: this is the one branch that renders no
  // `Header`, so the screen owns the whole viewport and brings its own brand.
  if (session.state === 'unavailable') {
    return <OutageScreen error={session.error} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={session.user} />
      <main className="flex-1">{children}</main>
      {/* Streamed separately so the feed fetch never holds up the page: the
          banner is fixed-positioned, so arriving late shifts nothing. */}
      <Suspense fallback={null}>
        <UpdateBannerSlot />
      </Suspense>
    </div>
  );
}
