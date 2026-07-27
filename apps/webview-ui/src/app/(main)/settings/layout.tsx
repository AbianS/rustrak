import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/actions/auth';
import { ServiceUnavailable } from '@/components/service-unavailable';
import { SettingsMobileNav } from './settings-mobile-nav';
import { SettingsNav } from './settings-nav';

export const metadata: Metadata = {
  title: 'Settings | Rustrak',
  description: 'Manage your Rustrak settings',
};

export default async function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentUser();

  if (session.state === 'anonymous') {
    redirect('/auth/login');
  }

  // Not a silent `isAdmin = false`. The old `user?.role === 'admin'` meant an
  // API outage rendered the settings nav with every admin entry missing, which
  // reads as "you were demoted" rather than "we could not ask".
  if (session.state === 'unavailable') {
    return <ServiceUnavailable error={session.error} />;
  }

  const isAdmin = session.user.role === 'admin';

  return (
    <div className="w-full">
      {/* Mobile top bar */}
      <div className="sticky top-16 z-40 bg-background flex items-center gap-3 border-b px-4 py-3 md:hidden">
        <SettingsMobileNav isAdmin={isAdmin} />
        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Settings
        </span>
      </div>

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border p-6 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 px-3">
            Settings
          </h2>
          <SettingsNav isAdmin={isAdmin} />
        </aside>

        {/* Main content */}
        <div className="flex-1 p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
