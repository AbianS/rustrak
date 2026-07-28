'use client';

import type { Issue } from '@rustrak/client';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  Bookmark,
  Check,
  MoreVertical,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { ISSUE_COLUMNS } from '@/features/issue/model/columns';
import {
  LevelBadge,
  PriorityIndicator,
  StatusIndicator,
} from '@/features/issue/ui/components/issue-indicators';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/components/shadcn/button';
import { Checkbox } from '@/shared/ui/components/shadcn/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/components/shadcn/dropdown-menu';
import { TrendSparkline } from '@/shared/ui/components/trend-sparkline';

export type IssueAction = 'resolve' | 'unresolve' | 'mute' | 'unmute';

/**
 * One issue in the list.
 *
 * The whole title block is the link, the trailing cells are not: a reader
 * scanning event counts should be able to select the number without navigating
 * away from the page they are scanning.
 */
export function IssueRow({
  issue,
  projectId,
  selected,
  onToggleSelect,
  onAction,
  onDelete,
}: {
  issue: Issue;
  projectId: number;
  selected: boolean;
  onToggleSelect: () => void;
  onAction: (action: IssueAction, issue: Issue) => void;
  onDelete: (issue: Issue) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors group">
      <Checkbox checked={selected} onCheckedChange={onToggleSelect} />

      <div className={ISSUE_COLUMNS.title}>
        <Link
          href={`/projects/${projectId}/issues/${issue.id}`}
          className="block group-hover:text-primary transition-colors"
        >
          <div className="flex items-center gap-2 mb-1">
            {issue.is_bookmarked && (
              <Bookmark className="size-4 text-primary shrink-0 fill-current" />
            )}
            <span className="font-semibold truncate">{issue.title}</span>
          </div>
          {issue.culprit && (
            <p className="text-xs text-muted-foreground/70 font-mono truncate mb-1.5">
              {issue.culprit}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <StatusIndicator issue={issue} />
            <PriorityIndicator priority={issue.priority} />
            <LevelBadge level={issue.level} />
            {issue.platform && <span>{issue.platform}</span>}
            <span className="font-mono text-muted-foreground/70">
              {issue.short_id}
            </span>
            {/* The one column a phone cannot show, folded into the title
                block so "when did this last happen" survives the narrow
                layout. */}
            <span className="sm:hidden">
              {formatDistanceToNow(new Date(issue.last_seen), {
                addSuffix: true,
              })}
            </span>
          </div>
        </Link>
      </div>

      <div className={cn(ISSUE_COLUMNS.trend, 'lg:flex justify-start')}>
        <TrendSparkline trend={issue.trend ?? []} />
      </div>

      <div className={ISSUE_COLUMNS.age}>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(issue.first_seen))}
        </span>
      </div>

      <div className={ISSUE_COLUMNS.events}>
        <span className="font-mono text-sm whitespace-nowrap">
          {issue.event_count.toLocaleString()}
        </span>
      </div>

      <div className={ISSUE_COLUMNS.users}>
        <span className="font-mono text-sm whitespace-nowrap">
          {(issue.user_count ?? 0).toLocaleString()}
        </span>
      </div>

      <div className={ISSUE_COLUMNS.lastSeen}>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(issue.last_seen), { addSuffix: true })}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="size-8" />}
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {issue.status !== 'resolved' && (
            <DropdownMenuItem onClick={() => onAction('resolve', issue)}>
              <Check className="mr-2 size-4" />
              Resolve
            </DropdownMenuItem>
          )}
          {issue.status === 'resolved' && (
            <DropdownMenuItem onClick={() => onAction('unresolve', issue)}>
              <AlertCircle className="mr-2 size-4" />
              Unresolve
            </DropdownMenuItem>
          )}
          {issue.status !== 'ignored' && (
            <DropdownMenuItem onClick={() => onAction('mute', issue)}>
              <VolumeX className="mr-2 size-4" />
              Mute
            </DropdownMenuItem>
          )}
          {issue.status === 'ignored' && (
            <DropdownMenuItem onClick={() => onAction('unmute', issue)}>
              <Volume2 className="mr-2 size-4" />
              Unmute
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(issue)}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
