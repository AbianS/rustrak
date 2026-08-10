'use client';

import type { Project } from '@rustrak/client';
import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { SettingRow, SettingSection } from '@/shared/ui/components/setting-row';
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
import { Button } from '@/shared/ui/components/shadcn/button';

/**
 * Removing the project, behind a confirmation that names it.
 *
 * Its own section rather than another row in the form above: everything there
 * is reversible by typing the old value back, and this is not.
 */
export function DangerZone({
  project,
  onRemove,
}: {
  project: Project;
  /** Resolves once the request is done, whether it succeeded or not. */
  onRemove: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations('projects');
  // Its own transition rather than the form's. Saving a name and removing the
  // project are unrelated requests, and sharing one `isPending` meant either
  // one in flight greyed out the other.
  const [isPending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      await onRemove();
      setIsOpen(false);
    });

  return (
    <>
      <SettingSection title={t('dangerZone.title')} destructive>
        <SettingRow
          title={t('dangerZone.remove')}
          description={t('dangerZone.removeDescription')}
        >
          <Button
            variant="destructive"
            onClick={() => setIsOpen(true)}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            <Trash2 className="mr-2 size-4" />
            {t('dangerZone.remove')}
          </Button>
        </SettingRow>
      </SettingSection>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('dangerZone.deleteTitle', { name: project.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('dangerZone.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t('dangerZone.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t('dangerZone.deleting')}
                </>
              ) : (
                t('dangerZone.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
