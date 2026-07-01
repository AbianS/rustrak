'use client';

import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * The issue detail right rail with a collapse toggle. Plain component state,
 * open by default — resets on every event navigation, which is fine here.
 * Desktop only — on mobile the rail is rendered inline in the main column.
 */
export function CollapsibleRail({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const toggleRail = () => setCollapsed((c) => !c);

  if (collapsed) {
    return (
      <div className="hidden lg:flex w-10 shrink-0 flex-col items-center border-l bg-card pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="size-8 px-0"
          aria-label="Open sidebar"
          title="Show sidebar"
          onClick={toggleRail}
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
          onClick={toggleRail}
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
      {children}
    </aside>
  );
}
