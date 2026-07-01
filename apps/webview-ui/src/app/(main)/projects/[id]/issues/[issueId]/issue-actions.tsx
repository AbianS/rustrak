'use client';

import type { Issue, IssuePriority } from '@rustrak/client';
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Rocket,
  Trash2,
  Undo,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  deleteIssue,
  resolveIssueInNextRelease,
  setIssueBookmark,
  setIssueSubscription,
  updateIssueState,
} from '@/actions/issues';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { priorityDisplay } from '@/lib/issue-status';
import { cn } from '@/lib/utils';

interface IssueActionsProps {
  issue: Issue;
  projectId: number;
}

const PRIORITIES: IssuePriority[] = ['high', 'medium', 'low'];

export function IssueActions({ issue, projectId }: IssueActionsProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const busy = pending !== null;
  const isResolved = issue.status === 'resolved';
  const isArchived = issue.status === 'ignored';
  const priorityMeta = priorityDisplay(issue.priority);

  const run = (action: string, fn: () => Promise<unknown>) => {
    setPending(action);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } finally {
        setPending(null);
      }
    });
  };

  const handleConfirmDelete = () => {
    setPending('delete');
    startTransition(async () => {
      try {
        await deleteIssue(projectId, issue.id);
        setDeleteDialogOpen(false);
        router.push(`/projects/${projectId}`);
      } finally {
        setPending(null);
      }
    });
  };

  return (
    <div className="flex items-center justify-between gap-x-3 gap-y-2 flex-wrap">
      {/* Left cluster */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Resolve (split) */}
        <div className="flex">
          <Button
            size="sm"
            className={cn(!isResolved && 'rounded-r-none')}
            variant={isResolved ? 'outline' : 'default'}
            disabled={busy}
            onClick={() =>
              run('resolve', () =>
                updateIssueState(projectId, issue.id, {
                  status: isResolved ? 'unresolved' : 'resolved',
                }),
              )
            }
          >
            {isResolved ? (
              <Undo className="mr-2 size-4" />
            ) : (
              <Check className="mr-2 size-4" />
            )}
            {isResolved ? 'Unresolve' : 'Resolve'}
          </Button>
          {!isResolved && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="sm"
                    className="rounded-l-none border-l border-primary-foreground/20 px-2"
                    aria-label="More resolve options"
                  />
                }
              >
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  disabled={busy}
                  onClick={() =>
                    run('next-release', () =>
                      resolveIssueInNextRelease(projectId, issue.id),
                    )
                  }
                >
                  <Rocket className="mr-2 size-4" />
                  Resolve in next release
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Archive (mute) */}
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() =>
            run('archive', () =>
              updateIssueState(projectId, issue.id, {
                status: isArchived ? 'unresolved' : 'ignored',
              }),
            )
          }
        >
          {isArchived ? (
            <ArchiveRestore className="mr-2 size-4" />
          ) : (
            <Archive className="mr-2 size-4" />
          )}
          {isArchived ? 'Unarchive' : 'Archive'}
        </Button>

        {/* Overflow */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="size-8 px-0"
                aria-label="Issue actions"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem
              disabled={busy}
              onClick={() =>
                run('bookmark', () =>
                  setIssueBookmark(projectId, issue.id, !issue.is_bookmarked),
                )
              }
            >
              {issue.is_bookmarked ? (
                <BookmarkCheck className="mr-2 size-4" />
              ) : (
                <Bookmark className="mr-2 size-4" />
              )}
              {issue.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onClick={() =>
                run('subscribe', () =>
                  setIssueSubscription(
                    projectId,
                    issue.id,
                    !issue.is_subscribed,
                  ),
                )
              }
            >
              {issue.is_subscribed ? (
                <BellOff className="mr-2 size-4" />
              ) : (
                <Bell className="mr-2 size-4" />
              )}
              {issue.is_subscribed ? 'Unsubscribe' : 'Subscribe'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={busy}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 size-4" />
              Delete issue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: priority */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Priority</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" disabled={busy} />}
          >
            {priorityMeta ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn('size-1.5 rounded-full', priorityMeta.dot)}
                />
                {priorityMeta.label}
              </span>
            ) : (
              <span className="text-muted-foreground">Set</span>
            )}
            <ChevronDown className="ml-1.5 size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PRIORITIES.map((priority) => {
              const meta = priorityDisplay(priority);
              return (
                <DropdownMenuItem
                  key={priority}
                  disabled={busy}
                  onClick={() =>
                    run('priority', () =>
                      updateIssueState(projectId, issue.id, { priority }),
                    )
                  }
                >
                  <span
                    className={cn(
                      'mr-2 size-1.5 rounded-full',
                      meta?.dot ?? 'bg-muted-foreground',
                    )}
                  />
                  {meta?.label ?? priority}
                  {issue.priority === priority && (
                    <Check className="ml-auto size-4 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this issue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this issue and all associated events.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending === 'delete'}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={pending === 'delete'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending === 'delete' ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
