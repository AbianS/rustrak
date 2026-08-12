import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/features/user/api/queries';
import { redirect } from '@/shared/i18n/redirect';
import { ServiceUnavailable } from '@/shared/ui/components/service-unavailable';
import { SettingsMobileNav } from './_components/settings-mobile-nav';
import { SettingsNav } from './_components/settings-nav';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return {
    title: t('nav.settingsTitle') + ' | Rustrak',
    description: t('meta.description'),
  };
}

export default async function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = await getTranslations('settings');
  const session = await getCurrentUser();

  if (session.state === 'anonymous') {
    return redirect('/auth/login');
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
          {t('nav.settingsTitle')}
        </span>
      </div>

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border p-6 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 px-3">
            {t('nav.settingsTitle')}
          </h2>
          <SettingsNav isAdmin={isAdmin} />
        </aside>

        {/* Main content */}
        <div className="flex-1 p-4 md:p-8">{children}</div>
      </div>
    </div>
  );
}
