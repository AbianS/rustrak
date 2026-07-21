import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@/actions/auth';
import { getUpdateInfo } from '@/actions/version-check';
import { UpdateBanner } from '@/components/update-banner';
import { Header } from './header';

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      <main className="flex-1">{children}</main>
      <Suspense fallback={null}>
        <UpdateBannerSlot />
      </Suspense>
    </div>
  );
}

// Streamed separately so the feed fetch never holds up the page: the banner is
// decorative and fixed-positioned, so arriving late shifts nothing.
async function UpdateBannerSlot() {
  const updateInfo = await getUpdateInfo();
  return updateInfo ? <UpdateBanner info={updateInfo} /> : null;
}
