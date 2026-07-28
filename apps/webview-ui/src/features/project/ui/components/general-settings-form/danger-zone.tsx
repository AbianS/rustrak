'use client';

import type { Project } from '@rustrak/client';
import { Loader2, Trash2 } from 'lucide-react';
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
      <SettingSection title="Danger Zone" destructive>
        <SettingRow
          title="Remove Project"
          description="Permanently deletes this project and all of its issues and events. This cannot be undone."
        >
          <Button
            variant="destructive"
            onClick={() => setIsOpen(true)}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            <Trash2 className="mr-2 size-4" />
            Remove Project
          </Button>
        </SettingRow>
      </SettingSection>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{project.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this project and all associated
              issues and events. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
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
    </>
  );
}
