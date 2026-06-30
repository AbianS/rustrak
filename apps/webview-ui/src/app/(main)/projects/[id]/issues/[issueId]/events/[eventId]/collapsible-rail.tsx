'use client';

import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export const RAIL_COOKIE = 'rustrak_rail_collapsed';

/**
 * The issue detail right rail with a Sentry-style collapse toggle. The collapsed
 * state is persisted in a cookie and read on the server (`defaultCollapsed`) so
 * the correct state renders on first paint — no expand→collapse flash on reload.
 * Desktop only — on mobile the rail is rendered inline in the main column.
 */
export function CollapsibleRail({
  title,
  defaultCollapsed = false,
  children,
}: {
  title: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${RAIL_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="hidden lg:flex w-10 shrink-0 flex-col items-center border-l bg-card pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="size-8 px-0"
          aria-label="Open sidebar"
          title="Show sidebar"
          onClick={toggle}
        >
          <ChevronsLeft className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <aside className="hidden lg:block w-[320px] shrink-0 overflow-y-auto border-l bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <h2 className="text-sm font-semibold truncate">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          className="size-8 px-0 shrink-0"
          aria-label="Close sidebar"
          title="Hide sidebar"
          onClick={toggle}
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
      {children}
    </aside>
  );
}
