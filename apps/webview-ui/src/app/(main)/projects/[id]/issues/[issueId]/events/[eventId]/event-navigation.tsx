'use client';

import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
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
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
        {/* First */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={!firstEventId || currentIndex === 1}
                asChild={!!firstEventId && currentIndex !== 1}
              >
                {firstEventId && currentIndex !== 1 ? (
                  <Link href={`${baseUrl}/${firstEventId}`}>
                    <ChevronFirst className="size-4" />
                  </Link>
                ) : (
                  <span>
                    <ChevronFirst className="size-4" />
                  </span>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>First event</p>
          </TooltipContent>
        </Tooltip>

        {/* Previous */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={!prevEventId}
                asChild={!!prevEventId}
              >
                {prevEventId ? (
                  <Link href={`${baseUrl}/${prevEventId}`}>
                    <ChevronLeft className="size-4" />
                  </Link>
                ) : (
                  <span>
                    <ChevronLeft className="size-4" />
                  </span>
                )}
              </Button>
            </span>
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
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={!nextEventId}
                asChild={!!nextEventId}
              >
                {nextEventId ? (
                  <Link href={`${baseUrl}/${nextEventId}`}>
                    <ChevronRight className="size-4" />
                  </Link>
                ) : (
                  <span>
                    <ChevronRight className="size-4" />
                  </span>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Next event</p>
          </TooltipContent>
        </Tooltip>

        {/* Last */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={!lastEventId || currentIndex === totalCount}
                asChild={!!lastEventId && currentIndex !== totalCount}
              >
                {lastEventId && currentIndex !== totalCount ? (
                  <Link href={`${baseUrl}/${lastEventId}`}>
                    <ChevronLast className="size-4" />
                  </Link>
                ) : (
                  <span>
                    <ChevronLast className="size-4" />
                  </span>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Last event</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
