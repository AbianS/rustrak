'use client';

import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { EventNavigation } from '@/actions/events';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

  return (
    <TooltipProvider delay={300}>
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
        {/* First */}
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={!firstEventId || currentIndex === 1}
              onClick={() => {
                if (firstEventId && currentIndex !== 1) {
                  router.push(`${baseUrl}/${firstEventId}`);
                }
              }}
            >
              <ChevronFirst className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>First event</p>
          </TooltipContent>
        </Tooltip>

        {/* Previous */}
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={!prevEventId}
              onClick={() => {
                if (prevEventId) {
                  router.push(`${baseUrl}/${prevEventId}`);
                }
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Previous event</p>
          </TooltipContent>
        </Tooltip>

        {/* Counter */}
        <div className="min-w-[100px] text-center">
          <span className="text-sm font-medium">
            Event <span className="font-bold text-primary">{currentIndex}</span>{' '}
            of <span className="font-bold">{totalCount}</span>
          </span>
        </div>

        {/* Next */}
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={!nextEventId}
              onClick={() => {
                if (nextEventId) {
                  router.push(`${baseUrl}/${nextEventId}`);
                }
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Next event</p>
          </TooltipContent>
        </Tooltip>

        {/* Last */}
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              disabled={!lastEventId || currentIndex === totalCount}
              onClick={() => {
                if (lastEventId && currentIndex !== totalCount) {
                  router.push(`${baseUrl}/${lastEventId}`);
                }
              }}
            >
              <ChevronLast className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Last event</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
