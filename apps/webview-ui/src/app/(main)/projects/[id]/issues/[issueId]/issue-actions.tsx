'use client';

import type { Issue } from '@rustrak/client';
import {
  Bell,
  BellOff,
  Check,
  Loader2,
  MoreVertical,
  Trash2,
  Undo,
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface IssueActionsProps {
  issue: Issue;
  projectId: number;
}

export function IssueActions({ issue, projectId }: IssueActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleResolve = () => {
    startTransition(async () => {
      await updateIssueState(projectId, issue.id, {
        is_resolved: !issue.is_resolved,
      });
      router.refresh();
    });
  };

  const handleMute = () => {
    startTransition(async () => {
      await updateIssueState(projectId, issue.id, {
        is_muted: !issue.is_muted,
      });
      router.refresh();
    });
  };

  const handleConfirmDelete = () => {
    startTransition(async () => {
      await deleteIssue(projectId, issue.id);
      setDeleteDialogOpen(false);
      router.push(`/projects/${projectId}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleResolve}
        disabled={isPending}
        variant={issue.is_resolved ? 'outline' : 'default'}
      >
        {isPending ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : issue.is_resolved ? (
          <Undo className="mr-2 size-4" />
        ) : (
          <Check className="mr-2 size-4" />
        )}
        {issue.is_resolved ? 'Unresolve' : 'Resolve'}
      </Button>

      <Button variant="outline" onClick={handleMute} disabled={isPending}>
        {issue.is_muted ? (
          <Bell className="mr-2 size-4" />
        ) : (
          <BellOff className="mr-2 size-4" />
        )}
        {issue.is_muted ? 'Unmute' : 'Mute'}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Delete Issue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
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
