'use client';

import type { OffsetPaginatedResponse, Project } from '@rustrak/client';
import { formatDistanceToNow } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Loader2,
  MoreVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlatformIcon } from 'platformicons';
import { useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteProject } from '@/features/project/api/mutations';
import { cn } from '@/lib/utils';
import { PROJECT_COLUMNS, ProjectStatsCells } from './project-stats-cells';

/** Shared styling for every column header in the table. */
const HEADER =
  'text-xs font-bold uppercase tracking-widest text-muted-foreground';

interface ProjectsListProps {
  initialProjects: OffsetPaginatedResponse<Project>;
  currentPage: number;
}

export function ProjectsList({
  initialProjects,
  currentPage,
}: ProjectsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isBatchDelete, setIsBatchDelete] = useState(false);

  const {
    items: serverProjects,
    total_count,
    total_pages,
    per_page,
  } = initialProjects;

  // Optimistic state for immediate UI feedback on deletion
  const [optimisticProjects, removeOptimistic] = useOptimistic(
    serverProjects,
    (state, deletedIds: number[]) =>
      state.filter((p) => !deletedIds.includes(p.id)),
  );

  const projects = optimisticProjects;

  const handlePageChange = (page: number) => {
    router.push(`/projects?page=${page}`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === projects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const openDeleteDialog = (project: Project) => {
    setProjectToDelete(project);
    setIsBatchDelete(false);
    setDeleteDialogOpen(true);
  };

  const openBatchDeleteDialog = () => {
    setProjectToDelete(null);
    setIsBatchDelete(true);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    const idsToDelete = isBatchDelete
      ? Array.from(selectedIds)
      : projectToDelete
        ? [projectToDelete.id]
        : [];

    if (idsToDelete.length === 0) return;

    // Close dialog immediately
    setDeleteDialogOpen(false);

    startTransition(async () => {
      // Optimistically remove from UI
      removeOptimistic(idsToDelete);

      for (const id of idsToDelete) {
        const result = await deleteProject(id);

        if (!result.success) {
          // Stop at the first failure rather than carrying on: the optimistic
          // removal is reverted by the refresh below, and continuing would
          // report "3 projects deleted" over a set where one survived.
          toast.error('Failed to delete', {
            description: result.error.message,
          });
          router.refresh();
          return;
        }
      }

      toast.success(
        idsToDelete.length > 1
          ? `${idsToDelete.length} projects deleted`
          : 'Project deleted',
      );

      if (isBatchDelete) {
        setSelectedIds(new Set());
      }
      setProjectToDelete(null);
      router.refresh();
    });
  };

  const startIndex = (currentPage - 1) * per_page + 1;
  const endIndex = Math.min(currentPage * per_page, total_count);

  return (
    <div className="flex flex-col h-full">
      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="shrink-0 flex items-center justify-end gap-2 mb-4">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} selected
          </span>
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

      {/* Projects Table */}
      {projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <FolderOpen className="size-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No projects yet</p>
          <p className="text-sm text-muted-foreground/70">
            Create your first project to start tracking errors
          </p>
          <Button
            className="mt-4"
            nativeButton={false}
            render={<Link href="/projects/new" />}
          >
            <Plus className="mr-2 size-4" />
            New Project
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col border rounded-lg">
          {/* Header */}
          <div className="shrink-0 flex items-center gap-4 px-4 py-3 bg-muted/50 border-b">
            <Checkbox
              checked={
                selectedIds.size === projects.length && projects.length > 0
              }
              onCheckedChange={toggleSelectAll}
            />
            {/* Stands in for the platform icon on each row. Without it the
                header's flex tracks are computed over a row 28px wider than
                the real ones and every column below drifts left. */}
            <span className="w-7 shrink-0" aria-hidden />
            <span className={cn(HEADER, PROJECT_COLUMNS.name)}>Project</span>
            <span className={cn(HEADER, PROJECT_COLUMNS.issues)}>Issues</span>
            <span className={cn(HEADER, PROJECT_COLUMNS.events)}>
              Events 24h
            </span>
            <span className={cn(HEADER, PROJECT_COLUMNS.total)}>Total</span>
            <span className={cn(HEADER, PROJECT_COLUMNS.trend)}>
              Issue activity
            </span>
            {/* Demoted from `sm` to `xl`: on a narrow viewport the age of a
                project loses to every column above, all of which say
                something about right now. */}
            <span className={cn(HEADER, PROJECT_COLUMNS.created)}>Created</span>
            <span className="w-8" />
          </div>

          {/* Scrollable Rows */}
          <div className="flex-1 overflow-auto">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-4 px-4 py-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors group"
              >
                <Checkbox
                  checked={selectedIds.has(project.id)}
                  onCheckedChange={() => toggleSelect(project.id)}
                />

                <PlatformIcon
                  platform={project.platform ?? 'other'}
                  size={28}
                  radius={5}
                  format="lg"
                  className="shrink-0"
                />

                <div className={PROJECT_COLUMNS.name}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="block group-hover:text-primary transition-colors"
                  >
                    {/* The DSN used to sit here. It is a secret-ish connection
                        string nobody reads at a glance, it forced the name
                        field to hog the row, and it already has a home in
                        settings/client-keys. */}
                    <div className="font-semibold text-base truncate">
                      {project.name}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground truncate">
                      {project.slug}
                    </div>
                  </Link>
                </div>

                <ProjectStatsCells
                  stats={project.stats}
                  totalEvents={project.digested_event_count}
                />

                <div className={PROJECT_COLUMNS.created}>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(project.created_at), {
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
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => openDeleteDialog(project)}
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

      {/* Pagination */}
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
                ? `Delete ${selectedIds.size} project${selectedIds.size > 1 ? 's' : ''}?`
                : `Delete "${projectToDelete?.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBatchDelete
                ? `This will permanently delete ${selectedIds.size} project${selectedIds.size > 1 ? 's' : ''} and all associated issues and events. This action cannot be undone.`
                : 'This will permanently delete this project and all associated issues and events. This action cannot be undone.'}
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
