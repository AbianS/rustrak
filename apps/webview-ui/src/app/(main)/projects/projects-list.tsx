'use client';

import type { OffsetPaginatedResponse, Project } from '@rustrak/client';
import { formatDistanceToNow } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Loader2,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteProject } from '@/actions/projects';
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

      try {
        // Actually delete
        for (const id of idsToDelete) {
          await deleteProject(id);
        }

        // Success toast
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
      } catch (err) {
        // Revert will happen automatically on refresh
        const message = err instanceof Error ? err.message : 'Delete failed';
        toast.error('Failed to delete', { description: message });
        router.refresh();
      }
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

      {/* Projects Table */}
      {projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <FolderOpen className="size-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No projects yet</p>
          <p className="text-sm text-muted-foreground/70">
            Create your first project to start tracking errors
          </p>
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
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex-1">
              Project
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground w-32 text-right">
              Created
            </span>
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

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/projects/${project.id}`}
                    className="block group-hover:text-primary transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-base">
                        {project.name}
                      </span>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {project.digested_event_count.toLocaleString()} events
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{project.slug}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="font-mono text-muted-foreground/70 truncate max-w-[400px]">
                        {project.dsn}
                      </span>
                    </div>
                  </Link>
                </div>

                <div className="w-32 text-right">
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(project.created_at), {
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
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(project)}
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

      {/* Pagination */}
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
