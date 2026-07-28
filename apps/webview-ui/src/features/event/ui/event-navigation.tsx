'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { EventNavigation } from '@/features/event/api/queries';

interface EventNavigationBarProps {
  projectId: number;
  issueId: string;
  navigation: EventNavigation;
}

export function EventNavigationBar({
  projectId,
  issueId,
  navigation,
}: EventNavigationBarProps) {
  const router = useRouter();
  const {
    currentIndex,
    totalCount,
    firstEventId,
    lastEventId,
    prevEventId,
    nextEventId,
  } = navigation;

  const baseUrl = `/projects/${projectId}/issues/${issueId}/events`;
  const go = (eventId?: string | null) => {
    if (eventId) {
      router.push(`${baseUrl}/${eventId}`);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="size-8 px-0"
        aria-label="Previous event"
        disabled={!prevEventId}
        onClick={() => go(prevEventId)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="size-8 px-0"
        aria-label="Next event"
        disabled={!nextEventId}
        onClick={() => go(nextEventId)}
      >
        <ChevronRight className="size-4" />
      </Button>

      <span className="mx-1.5 text-xs tabular-nums text-muted-foreground">
        {currentIndex} of {totalCount}
      </span>

      <Button
        variant="ghost"
        size="sm"
        disabled={currentIndex <= 1 || !firstEventId}
        onClick={() => go(firstEventId)}
      >
        First
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={currentIndex >= totalCount || !lastEventId}
        onClick={() => go(lastEventId)}
      >
        Latest
      </Button>
    </div>
  );
}
