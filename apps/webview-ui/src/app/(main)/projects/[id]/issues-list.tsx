'use client';

import type { Issue, OffsetPaginatedResponse } from '@rustrak/client';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  Bell,
  BellOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteIssue, updateIssueState } from '@/actions/issues';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  const handleFilterChange = (filter: string) => {
    router.push(`/projects/${projectId}?filter=${filter}&page=1`);
  };

  const handlePageChange = (page: number) => {
    router.push(`/projects/${projectId}?filter=${currentFilter}&page=${page}`);
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
  ) => {
    startTransition(async () => {
      for (const id of selectedIds) {
        await updateIssueState(projectId, id, {
          is_resolved:
            action === 'resolve'
              ? true
              : action === 'unresolve'
                ? false
                : undefined,
          is_muted:
            action === 'mute' ? true : action === 'unmute' ? false : undefined,
        });
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
        for (const id of selectedIds) {
          await deleteIssue(projectId, id);
        }
        setSelectedIds(new Set());
      } else if (issueToDelete) {
        await deleteIssue(projectId, issueToDelete.id);
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
      {/* Filters - fixed at top */}
      <div className="shrink-0 flex items-center justify-between mb-4">
        <Tabs value={currentFilter} onValueChange={handleFilterChange}>
          <TabsList>
            {FILTERS.map((filter) => (
              <TabsTrigger key={filter.value} value={filter.value}>
                {filter.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
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
              <BellOff className="mr-1 size-3" />
              Mute
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openBatchDeleteDialog}
              disabled={isPending}
              className="text-destructive hover:text-destructive"
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
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground w-24 text-right">
              Events
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground w-32 text-right">
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
                      {issue.is_resolved && (
                        <Check className="size-4 text-primary shrink-0" />
                      )}
                      {issue.is_muted && (
                        <BellOff className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-semibold truncate">
                        {issue.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {issue.platform && (
                        <Badge variant="outline" className="text-[10px]">
                          {issue.platform}
                        </Badge>
                      )}
                      {issue.level && (
                        <Badge
                          variant={
                            issue.level === 'error'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {issue.level}
                        </Badge>
                      )}
                      <span className="font-mono">{issue.short_id}</span>
                    </div>
                  </Link>
                </div>

                <div className="w-24 text-right">
                  <span className="font-mono text-sm">
                    {issue.event_count.toLocaleString()}
                  </span>
                </div>

                <div className="w-32 text-right">
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(issue.last_seen), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!issue.is_resolved && (
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedIds(new Set([issue.id]));
                          handleBatchAction('resolve');
                        }}
                      >
                        <Check className="mr-2 size-4" />
                        Resolve
                      </DropdownMenuItem>
                    )}
                    {issue.is_resolved && (
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedIds(new Set([issue.id]));
                          handleBatchAction('unresolve');
                        }}
                      >
                        <AlertCircle className="mr-2 size-4" />
                        Unresolve
                      </DropdownMenuItem>
                    )}
                    {!issue.is_muted && (
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedIds(new Set([issue.id]));
                          handleBatchAction('mute');
                        }}
                      >
                        <BellOff className="mr-2 size-4" />
                        Mute
                      </DropdownMenuItem>
                    )}
                    {issue.is_muted && (
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedIds(new Set([issue.id]));
                          handleBatchAction('unmute');
                        }}
                      >
                        <Bell className="mr-2 size-4" />
                        Unmute
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(issue)}
                      className="text-destructive focus:text-destructive"
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
        <div className="shrink-0 flex items-center justify-between pt-4">
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
