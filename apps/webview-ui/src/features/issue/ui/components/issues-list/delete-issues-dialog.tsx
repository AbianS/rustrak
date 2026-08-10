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
 * The confirmation for deleting one issue or a ticked batch.
 *
 * One dialog for both because the question is the same and only the count
 * changes: `count` of 1 is the single-issue case, so the caller never has to
 * say which mode it is in.
 */
export function DeleteIssuesDialog({
  open,
  onOpenChange,
  count,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  isPending: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations('issues');

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {count > 1
              ? t('deleteDialog.titleMany', { count })
              : t('deleteDialog.titleOne')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {count > 1
              ? t('deleteDialog.descriptionMany', { count })
              : t('deleteDialog.descriptionOne')}
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
