'use client';

import type { SourceMapGcResult } from '@rustrak/client';
import { FileCode2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  gcStorageSourceMaps,
  previewStorageSourceMapGc,
} from '@/actions/storage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatBytes } from '@/lib/utils';

export function SourceMapGc() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<SourceMapGcResult | null>(null);

  const handlePreview = () => {
    startTransition(async () => {
      try {
        setPreview(await previewStorageSourceMapGc());
      } catch {
        toast.error('Could not preview source-map cleanup');
      }
    });
  };

  const handleGc = () => {
    startTransition(async () => {
      try {
        const result = await gcStorageSourceMaps();
        toast.success(
          `Removed ${result.files_removed.toLocaleString()} orphaned source maps (${formatBytes(result.bytes_freed)} freed)`,
        );
        setPreview(null);
        router.refresh();
      } catch {
        toast.error('Source-map cleanup failed');
      }
    });
  };

  const nothingToClean = preview !== null && preview.files_removed === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode2 className="size-4" />
          Orphaned source maps
        </CardTitle>
        <CardDescription>
          Remove source-map files no longer referenced by any upload — for
          example, files left behind when a project was deleted. Preview first;
          referenced files are never touched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="outline"
          onClick={handlePreview}
          disabled={isPending}
        >
          {isPending ? 'Working…' : 'Preview'}
        </Button>

        {preview !== null && (
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            {nothingToClean ? (
              <p className="text-muted-foreground">
                No orphaned source maps — nothing to clean up.
              </p>
            ) : (
              <>
                <p className="font-semibold mb-1">This cleanup would remove:</p>
                <ul className="text-muted-foreground space-y-0.5 tabular-nums">
                  <li>
                    {preview.files_removed.toLocaleString()} orphaned source
                    maps
                  </li>
                  <li>{formatBytes(preview.bytes_freed)} freed</li>
                </ul>

                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="destructive"
                        className="mt-3"
                        disabled={isPending}
                      />
                    }
                  >
                    <FileCode2 className="mr-2 size-4" />
                    Remove orphaned source maps
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Remove {preview.files_removed.toLocaleString()} orphaned
                        source maps?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes{' '}
                        {preview.files_removed.toLocaleString()} source-map
                        files ({formatBytes(preview.bytes_freed)}) that no
                        upload references, from the database and disk.
                        Referenced files are not affected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isPending}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleGc}
                        disabled={isPending}
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        {isPending ? 'Removing…' : 'Remove'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
