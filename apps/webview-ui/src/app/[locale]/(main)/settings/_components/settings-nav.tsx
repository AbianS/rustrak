'use client';

import { Database, Info, Key, Palette, Plug, User, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/shared/i18n/navigation';
import { cn } from '@/shared/lib/utils';

const navItems = [
  { href: '/settings/tokens', labelKey: 'nav.apiTokens', icon: Key },
  { href: '/settings/integrations', labelKey: 'nav.integrations', icon: Plug },
  {
    href: '/settings/team',
    labelKey: 'nav.team',
    icon: Users,
    adminOnly: true,
  },
  {
    href: '/settings/storage',
    labelKey: 'nav.storage',
    icon: Database,
    adminOnly: true,
  },
  { href: '/settings/account', labelKey: 'nav.account', icon: User },
  { href: '/settings/appearance', labelKey: 'nav.appearance', icon: Palette },
  { href: '/settings/about', labelKey: 'nav.about', icon: Info },
];

interface SettingsNavProps {
  onNavigate?: () => void;
  isAdmin?: boolean;
}

export function SettingsNav({ onNavigate, isAdmin = false }: SettingsNavProps) {
  const t = useTranslations('settings');
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="flex flex-col gap-1">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground font-bold'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon className="size-4" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
