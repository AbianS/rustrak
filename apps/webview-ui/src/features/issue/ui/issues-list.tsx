'use client';

import type { Issue, OffsetPaginatedResponse } from '@rustrak/client';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreVertical,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  bulkDeleteIssues,
  bulkUpdateIssues,
  deleteIssue,
} from '@/features/issue/api/mutations';
import {
  LevelBadge,
  PriorityIndicator,
  StatusIndicator,
} from '@/features/issue/ui/issue-indicators';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/shadcn/alert-dialog';
import { Button } from '@/shared/ui/shadcn/button';
import { Checkbox } from '@/shared/ui/shadcn/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/shadcn/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/shadcn/tabs';
import { TrendSparkline } from '@/shared/ui/trend-sparkline';

interface IssuesListProps {
  projectId: number;
  initialIssues: OffsetPaginatedResponse<Issue>;
  currentFilter: string;
  currentPage: number;
}

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'muted', label: 'Muted' },
  { value: 'all', label: 'All' },
];

export function IssuesList({
  projectId,
  initialIssues,
  currentFilter,
  currentPage,
}: IssuesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [isBatchDelete, setIsBatchDelete] = useState(false);

  const { items: issues, total_count, total_pages, per_page } = initialIssues;

  const buildUrl = (params: { filter?: string; page?: number }) => {
    const search = new URLSearchParams();
    search.set('filter', params.filter ?? currentFilter);
    search.set('page', String(params.page ?? 1));
    return `/projects/${projectId}/issues?${search.toString()}`;
  };

  const handleFilterChange = (filter: string) => {
    router.push(buildUrl({ filter, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    router.push(buildUrl({ page }));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === issues.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(issues.map((i) => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBatchAction = async (
    action: 'resolve' | 'unresolve' | 'mute' | 'unmute',
    ids: Set<string> = selectedIds,
  ) => {
    const status =
      action === 'resolve'
        ? 'resolved'
        : action === 'mute'
          ? 'ignored'
          : 'unresolved';
    startTransition(async () => {
      // The failure is a returned value now, so an unchecked call would clear
      // the selection and refresh back to the old state with nothing said.
      const result = await bulkUpdateIssues(projectId, {
        ids: Array.from(ids),
        status,
      });

      if (!result.success) {
        toast.error('Failed to update issues', {
          description: result.error.message,
        });
        return;
      }

      setSelectedIds(new Set());
      router.refresh();
    });
  };

  const openDeleteDialog = (issue: Issue) => {
    setIssueToDelete(issue);
    setIsBatchDelete(false);
    setDeleteDialogOpen(true);
  };

  const openBatchDeleteDialog = () => {
    setIssueToDelete(null);
    setIsBatchDelete(true);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    startTransition(async () => {
      if (isBatchDelete) {
        const result = await bulkDeleteIssues(projectId, {
          ids: Array.from(selectedIds),
        });
        if (!result.success) {
          toast.error('Failed to delete issues', {
            description: result.error.message,
          });
          return;
        }
        setSelectedIds(new Set());
      } else if (issueToDelete) {
        const result = await deleteIssue(projectId, issueToDelete.id);
        if (!result.success) {
          toast.error('Failed to delete issue', {
            description: result.error.message,
          });
          return;
        }
      }
      setDeleteDialogOpen(false);
      setIssueToDelete(null);
      router.refresh();
    });
  };

  const startIndex = (currentPage - 1) * per_page + 1;
  const endIndex = Math.min(currentPage * per_page, total_count);

  return (
    <div className="flex flex-col h-full">
      {/* Filters + Batch Actions */}
      <div className="shrink-0 flex flex-col gap-2 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <Tabs value={currentFilter} onValueChange={handleFilterChange}>
            <TabsList>
              {FILTERS.map((filter) => (
                <TabsTrigger key={filter.value} value={filter.value}>
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchAction('resolve')}
              disabled={isPending}
            >
              <Check className="mr-1 size-3" />
              Resolve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBatchAction('mute')}
              disabled={isPending}
            >
              <VolumeX className="mr-1 size-3" />
              Mute
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={openBatchDeleteDialog}
              disabled={isPending}
            >
              <Trash2 className="mr-1 size-3" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Issues Table - scrollable */}
      {issues.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <AlertCircle className="size-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No issues found</p>
          <p className="text-sm text-muted-foreground/70">
            {currentFilter === 'open'
              ? 'All issues are resolved or muted'
              : `No ${currentFilter} issues`}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col border rounded-lg">
          {/* Header */}
          <div className="shrink-0 flex items-center gap-4 px-4 py-3 bg-muted/50 border-b">
            <Checkbox
              checked={selectedIds.size === issues.length && issues.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex-1">
              Issue
            </span>
            <span className="hidden lg:block text-xs font-bold uppercase tracking-widest text-muted-foreground w-16">
              Trend
            </span>
            <span className="hidden lg:block text-xs font-bold uppercase tracking-widest text-muted-foreground w-24 text-right">
              Age
            </span>
            <span className="hidden sm:block text-xs font-bold uppercase tracking-widest text-muted-foreground w-24 text-right">
              Events
            </span>
            <span className="hidden lg:block text-xs font-bold uppercase tracking-widest text-muted-foreground w-20 text-right">
              Users
            </span>
            <span className="hidden sm:block text-xs font-bold uppercase tracking-widest text-muted-foreground w-36 text-right">
              Last Seen
            </span>
            <span className="w-8" />
          </div>

          {/* Scrollable Rows */}
          <div className="flex-1 overflow-auto">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors group"
              >
                <Checkbox
                  checked={selectedIds.has(issue.id)}
                  onCheckedChange={() => toggleSelect(issue.id)}
                />

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/projects/${projectId}/issues/${issue.id}`}
                    className="block group-hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {issue.is_bookmarked && (
                        <Bookmark className="size-4 text-primary shrink-0 fill-current" />
                      )}
                      <span className="font-semibold truncate">
                        {issue.title}
                      </span>
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
                      <span className="sm:hidden">
                        {formatDistanceToNow(new Date(issue.last_seen), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </Link>
                </div>

                <div className="hidden lg:flex w-16 justify-start">
                  <TrendSparkline trend={issue.trend ?? []} />
                </div>

                <div className="hidden lg:block w-24 text-right">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(issue.first_seen))}
                  </span>
                </div>

                <div className="hidden sm:block w-24 text-right">
                  <span className="font-mono text-sm whitespace-nowrap">
                    {issue.event_count.toLocaleString()}
                  </span>
                </div>

                <div className="hidden lg:block w-20 text-right">
                  <span className="font-mono text-sm whitespace-nowrap">
                    {(issue.user_count ?? 0).toLocaleString()}
                  </span>
                </div>

                <div className="hidden sm:block w-36 text-right">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(issue.last_seen), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon" className="size-8" />
                    }
                  >
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {issue.status !== 'resolved' && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleBatchAction('resolve', new Set([issue.id]))
                        }
                      >
                        <Check className="mr-2 size-4" />
                        Resolve
                      </DropdownMenuItem>
                    )}
                    {issue.status === 'resolved' && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleBatchAction('unresolve', new Set([issue.id]))
                        }
                      >
                        <AlertCircle className="mr-2 size-4" />
                        Unresolve
                      </DropdownMenuItem>
                    )}
                    {issue.status !== 'ignored' && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleBatchAction('mute', new Set([issue.id]))
                        }
                      >
                        <VolumeX className="mr-2 size-4" />
                        Mute
                      </DropdownMenuItem>
                    )}
                    {issue.status === 'ignored' && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleBatchAction('unmute', new Set([issue.id]))
                        }
                      >
                        <Volume2 className="mr-2 size-4" />
                        Unmute
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => openDeleteDialog(issue)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination - fixed at bottom */}
      {total_pages > 0 && (
        <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 pt-4">
          <span className="text-sm text-muted-foreground">
            {total_count > 0
              ? `Showing ${startIndex}-${endIndex} of ${total_count}`
              : 'No results'}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || isPending}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <span className="text-sm px-2">
              Page {currentPage} of {total_pages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= total_pages || isPending}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBatchDelete
                ? `Delete ${selectedIds.size} issue${selectedIds.size > 1 ? 's' : ''}?`
                : 'Delete this issue?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBatchDelete
                ? `This will permanently delete ${selectedIds.size} issue${selectedIds.size > 1 ? 's' : ''} and all associated events. This action cannot be undone.`
                : 'This will permanently delete this issue and all associated events. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
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
