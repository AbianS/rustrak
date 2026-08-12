'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('projects');
  // A named target is always exactly one, whatever `count` says: the dialog is
  // then confirming that project rather than a selection.
  const subject = t('deleteDialog.subject', { count: targetName ? 1 : count });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {targetName
              ? t('deleteDialog.titleNamed', { name: targetName })
              : t('deleteDialog.titleCount', { count })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteDialog.description', { subject })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t('deleteDialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t('deleteDialog.deleting')}
              </>
            ) : (
              t('deleteDialog.confirm')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
