'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import {
  OVERVIEW_PERIODS,
  type OverviewPeriod,
} from '@/features/release/model/session-health';
import { Button } from '@/shared/ui/components/shadcn/button';

interface OverviewPeriodFilterProps {
  projectId: number;
  /** Active window, or undefined for all time. */
  activePeriod?: OverviewPeriod;
}

/**
 * Time-window selector for the overview, held in the URL so the page stays a
 * Server Component and the window survives a reload or a shared link.
 */
export function OverviewPeriodFilter({
  projectId,
  activePeriod,
}: OverviewPeriodFilterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (period?: OverviewPeriod) => {
    const query = period ? `?period=${period}` : '';
    startTransition(() => {
      router.push(`/projects/${projectId}${query}`);
    });
  };

  return (
    <div
      className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1"
      data-pending={isPending ? '' : undefined}
    >
      {OVERVIEW_PERIODS.map((period) => (
        <Button
          key={period}
          variant={activePeriod === period ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 px-3"
          onClick={() => navigate(period)}
          disabled={isPending}
        >
          {period}
        </Button>
      ))}
      <Button
        variant={!activePeriod ? 'secondary' : 'ghost'}
        size="sm"
        className="h-7 px-3"
        onClick={() => navigate()}
        disabled={isPending}
      >
        All
      </Button>
    </div>
  );
}
