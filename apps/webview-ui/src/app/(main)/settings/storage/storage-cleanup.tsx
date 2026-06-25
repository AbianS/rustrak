'use client';

import type { CleanupCounts } from '@rustrak/client';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  executeStorageCleanup,
  previewStorageCleanup,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StorageCleanupProps {
  projects: { id: number; name: string }[];
}

const PERIODS = [
  { value: '1', label: 'Older than 1 day' },
  { value: '7', label: 'Older than 7 days' },
  { value: '30', label: 'Older than 30 days' },
  { value: '60', label: 'Older than 60 days' },
  { value: '90', label: 'Older than 90 days' },
];

const ALL_SCOPE = 'all';

export function StorageCleanup({ projects }: StorageCleanupProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState('90');
  const [scope, setScope] = useState(ALL_SCOPE);
  const [preview, setPreview] = useState<CleanupCounts | null>(null);

  const olderThanDays = Number(period);
  const projectId = scope === ALL_SCOPE ? undefined : Number(scope);

  // A new period/scope invalidates a stale preview — force a fresh dry-run.
  const resetPreview = () => setPreview(null);

  const handlePreview = () => {
    startTransition(async () => {
      try {
        const counts = await previewStorageCleanup({
          older_than_days: olderThanDays,
          project_id: projectId,
        });
        setPreview(counts);
      } catch {
        toast.error('Could not preview cleanup');
      }
    });
  };

  const handleExecute = () => {
    startTransition(async () => {
      try {
        const counts = await executeStorageCleanup({
          older_than_days: olderThanDays,
          project_id: projectId,
        });
        toast.success(
          `Removed ${counts.events.toLocaleString()} events, ${counts.transactions.toLocaleString()} transactions, ${counts.spans.toLocaleString()} spans`,
        );
        setPreview(null);
        router.refresh();
      } catch {
        toast.error('Cleanup failed');
      }
    });
  };

  const periodLabel = (value: string) =>
    PERIODS.find((p) => p.value === value)?.label ?? value;
  const scopeLabel = (value: string) =>
    value === ALL_SCOPE
      ? 'All projects'
      : (projects.find((p) => String(p.id) === value)?.name ?? value);

  const nothingToDelete =
    preview !== null &&
    preview.events === 0 &&
    preview.transactions === 0 &&
    preview.spans === 0;

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="size-4" />
          Clean up old data
        </CardTitle>
        <CardDescription>
          Permanently delete events, transactions and spans older than the
          selected period. Always preview first — this cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={period}
            onValueChange={(value) => {
              if (value) {
                setPeriod(value);
                resetPreview();
              }
            }}
            disabled={isPending}
          >
            <SelectTrigger className="sm:w-56" aria-label="Retention period">
              <SelectValue>{(value) => periodLabel(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={scope}
            onValueChange={(value) => {
              if (value) {
                setScope(value);
                resetPreview();
              }
            }}
            disabled={isPending}
          >
            <SelectTrigger className="sm:w-56" aria-label="Project scope">
              <SelectValue>{(value) => scopeLabel(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SCOPE}>All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={handlePreview}
            disabled={isPending}
          >
            {isPending ? 'Working…' : 'Preview'}
          </Button>
        </div>

        {preview !== null && (
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <p className="font-semibold mb-1">This cleanup would remove:</p>
            <ul className="text-muted-foreground space-y-0.5 tabular-nums">
              <li>{preview.events.toLocaleString()} events</li>
              <li>{preview.transactions.toLocaleString()} transactions</li>
              <li>{preview.spans.toLocaleString()} spans</li>
              <li>{preview.issues_removed.toLocaleString()} empty issues</li>
            </ul>

            {nothingToDelete ? (
              <p className="mt-3 text-muted-foreground">
                Nothing matches this period — there's nothing to delete.
              </p>
            ) : (
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
                  <Trash2 className="mr-2 size-4" />
                  Delete permanently
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="size-5 text-destructive" />
                      Delete {preview.events.toLocaleString()} events and more?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes data {periodLabel(period)} for{' '}
                      {scopeLabel(scope)} (
                      {preview.transactions.toLocaleString()} transactions,{' '}
                      {preview.spans.toLocaleString()} spans,{' '}
                      {preview.issues_removed.toLocaleString()} empty issues).
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleExecute}
                      disabled={isPending}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {isPending ? 'Deleting…' : 'Delete permanently'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
