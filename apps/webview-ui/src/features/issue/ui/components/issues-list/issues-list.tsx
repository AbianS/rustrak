'use client';

import type { Issue, OffsetPaginatedResponse } from '@rustrak/client';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  bulkDeleteIssues,
  bulkUpdateIssues,
  deleteIssue,
} from '@/features/issue/api/mutations';
import { ISSUE_COLUMNS } from '@/features/issue/model/columns';
import { cn } from '@/shared/lib/utils';
import { Checkbox } from '@/shared/ui/components/shadcn/checkbox';
import { TablePagination } from '@/shared/ui/components/table-pagination';
import { useRowSelection } from '@/shared/ui/hooks/use-row-selection';
import { DeleteIssuesDialog } from './delete-issues-dialog';
import { IssueFilters } from './issue-filters';
import { type IssueAction, IssueRow } from './issue-row';

interface IssuesListProps {
  projectId: number;
  initialIssues: OffsetPaginatedResponse<Issue>;
  currentFilter: string;
  currentPage: number;
}

/** The status a batch action leaves its issues in. */
const STATUS_FOR: Record<IssueAction, 'resolved' | 'ignored' | 'unresolved'> = {
  resolve: 'resolved',
  mute: 'ignored',
  unresolve: 'unresolved',
  unmute: 'unresolved',
};

const HEADER =
  'text-xs font-bold uppercase tracking-widest text-muted-foreground';

export function IssuesList({
  projectId,
  initialIssues,
  currentFilter,
  currentPage,
}: IssuesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { items: issues, total_count, total_pages, per_page } = initialIssues;

  const selection = useRowSelection(issues.map((i) => i.id));

  // Null means "no single issue targeted", which is how the dialog tells a
  // row delete from a batch delete without a second flag to keep in step.
  const [pendingDelete, setPendingDelete] = useState<Issue | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const buildUrl = (params: { filter?: string; page?: number }) => {
    const search = new URLSearchParams();
    search.set('filter', params.filter ?? currentFilter);
    search.set('page', String(params.page ?? 1));
    return `/projects/${projectId}/issues?${search.toString()}`;
  };

  const applyAction = (action: IssueAction, ids: readonly string[]) => {
    startTransition(async () => {
      // The failure is a returned value now, so an unchecked call would clear
      // the selection and refresh back to the old state with nothing said.
      const result = await bulkUpdateIssues(projectId, {
        ids: [...ids],
        status: STATUS_FOR[action],
      });

      if (!result.success) {
        toast.error('Failed to update issues', {
          description: result.error.message,
        });
        return;
      }

      selection.clear();
      router.refresh();
    });
  };

  const confirmDelete = () => {
    startTransition(async () => {
      const result = pendingDelete
        ? await deleteIssue(projectId, pendingDelete.id)
        : await bulkDeleteIssues(projectId, { ids: [...selection.ids] });

      if (!result.success) {
        toast.error(
          pendingDelete ? 'Failed to delete issue' : 'Failed to delete issues',
          { description: result.error.message },
        );
        return;
      }

      if (!pendingDelete) selection.clear();
      setDeleteOpen(false);
      setPendingDelete(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col h-full">
      <IssueFilters
        currentFilter={currentFilter}
        onFilterChange={(filter) => router.push(buildUrl({ filter, page: 1 }))}
        selectedCount={selection.count}
        disabled={isPending}
        onBatchAction={(action) => applyAction(action, [...selection.ids])}
        onBatchDelete={() => {
          setPendingDelete(null);
          setDeleteOpen(true);
        }}
      />

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
          <div className="shrink-0 flex items-center gap-4 px-4 py-3 bg-muted/50 border-b">
            <Checkbox
              checked={selection.allSelected}
              onCheckedChange={selection.toggleAll}
            />
            <span className={cn(HEADER, ISSUE_COLUMNS.title)}>Issue</span>
            <span className={cn(HEADER, ISSUE_COLUMNS.trend)}>Trend</span>
            <span className={cn(HEADER, ISSUE_COLUMNS.age)}>Age</span>
            <span className={cn(HEADER, ISSUE_COLUMNS.events)}>Events</span>
            <span className={cn(HEADER, ISSUE_COLUMNS.users)}>Users</span>
            <span className={cn(HEADER, ISSUE_COLUMNS.lastSeen)}>
              Last Seen
            </span>
            <span className={ISSUE_COLUMNS.actions} />
          </div>

          <div className="flex-1 overflow-auto">
            {issues.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                projectId={projectId}
                selected={selection.isSelected(issue.id)}
                onToggleSelect={() => selection.toggle(issue.id)}
                onAction={(action, target) => applyAction(action, [target.id])}
                onDelete={(target) => {
                  setPendingDelete(target);
                  setDeleteOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      )}

      <TablePagination
        currentPage={currentPage}
        totalPages={total_pages}
        totalCount={total_count}
        perPage={per_page}
        disabled={isPending}
        onPageChange={(page) => router.push(buildUrl({ page }))}
      />

      {isPending && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}

      <DeleteIssuesDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        count={pendingDelete ? 1 : selection.count}
        isPending={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
