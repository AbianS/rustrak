'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SettingsTabsProps {
  projectId: number;
}

/**
 * Underline tab strip navigating between project settings pages. Plain
 * Links styled as tabs — not the interactive `Tabs` primitive, which is
 * built for switching panels within one page via controlled state, not for
 * navigating between real routes.
 */
export function SettingsTabs({ projectId }: SettingsTabsProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/settings`;

  const items = [
    { href: `${base}/general`, label: 'General' },
    { href: `${base}/alerts`, label: 'Alerts' },
    { href: `${base}/members`, label: 'Members' },
  ];

  return (
    <nav className="no-scrollbar flex gap-5 overflow-x-auto">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative shrink-0 whitespace-nowrap py-3 text-sm font-medium transition-colors',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            <span
              className={cn(
                'absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-colors',
                isActive ? 'bg-primary' : 'bg-transparent',
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
