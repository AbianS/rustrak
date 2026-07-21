import { redirect } from 'next/navigation';
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

  const updateInfo = await getUpdateInfo();

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      <main className="flex-1">{children}</main>
      {updateInfo && <UpdateBanner info={updateInfo} />}
    </div>
  );
}
