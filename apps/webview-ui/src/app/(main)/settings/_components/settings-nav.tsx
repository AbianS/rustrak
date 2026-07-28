'use client';

import { Database, Info, Key, Palette, Plug, User, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/utils';

const navItems = [
  { href: '/settings/tokens', label: 'API Tokens', icon: Key },
  { href: '/settings/integrations', label: 'Integrations', icon: Plug },
  { href: '/settings/team', label: 'Team', icon: Users, adminOnly: true },
  {
    href: '/settings/storage',
    label: 'Storage',
    icon: Database,
    adminOnly: true,
  },
  { href: '/settings/account', label: 'Account', icon: User },
  { href: '/settings/appearance', label: 'Appearance', icon: Palette },
  { href: '/settings/about', label: 'About', icon: Info },
];

interface SettingsNavProps {
  onNavigate?: () => void;
  isAdmin?: boolean;
}

export function SettingsNav({ onNavigate, isAdmin = false }: SettingsNavProps) {
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
