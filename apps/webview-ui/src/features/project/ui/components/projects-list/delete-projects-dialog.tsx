'use client';

import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/components/shadcn/alert-dialog';

/**
 * The confirmation for deleting one project or a ticked batch.
 *
 * `targetName` is what distinguishes the two: naming the project is worth a
 * lot on a destructive action, and a batch has no single name to give.
 */
export function DeleteProjectsDialog({
  open,
  onOpenChange,
  count,
  targetName,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  targetName?: string;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const subject = targetName
    ? 'this project'
    : `${count} project${count > 1 ? 's' : ''}`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {targetName
              ? `Delete "${targetName}"?`
              : `Delete ${count} project${count > 1 ? 's' : ''}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {subject} and all associated issues and
            events. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
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
  );
}
