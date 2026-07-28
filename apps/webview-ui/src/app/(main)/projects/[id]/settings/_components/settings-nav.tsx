'use client';

import { Bell, KeyRound, SlidersHorizontal, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/lib/utils';

interface NavGroup {
  /** Rendered above the group. Omit for a single ungrouped list. */
  label?: string;
  items: {
    segment: string;
    label: string;
    icon: React.ElementType;
  }[];
}

/**
 * Grouped so this keeps working as project settings grow, mirroring how Sentry
 * splits the equivalent nav (General / Processing / SDK Setup). Later additions
 * become new entries or new groups here rather than a longer flat list.
 */
const navGroups: NavGroup[] = [
  {
    label: 'Project',
    items: [
      { segment: 'general', label: 'General', icon: SlidersHorizontal },
      { segment: 'alerts', label: 'Alerts', icon: Bell },
      { segment: 'members', label: 'Members', icon: Users },
    ],
  },
  {
    label: 'SDK Setup',
    items: [{ segment: 'client-keys', label: 'Client Keys', icon: KeyRound }],
  },
];

interface ProjectSettingsNavProps {
  projectId: number;
  onNavigate?: () => void;
}

export function ProjectSettingsNav({
  projectId,
  onNavigate,
}: ProjectSettingsNavProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/settings`;
  const showLabels = navGroups.length > 1;

  return (
    <nav className="flex flex-col gap-6">
      {navGroups.map((group, index) => (
        // `navGroups` is a module-level constant. The index is the fallback for
        // the one group that carries no label, and it cannot collide because a
        // label is either present and unique or absent exactly once.
        // react-doctor-disable-next-line react-doctor/no-array-index-as-key
        <div key={group.label ?? index} className="flex flex-col gap-1">
          {showLabels && group.label && (
            <span className="mb-1 px-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {group.label}
            </span>
          )}
          {group.items.map((item) => {
            const href = `${base}/${item.segment}`;
            const Icon = item.icon;
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary font-bold text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
