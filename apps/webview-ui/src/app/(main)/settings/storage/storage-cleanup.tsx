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
import { Checkbox } from '@/components/ui/checkbox';
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

/** The three selectable data categories. `events` also governs the issues that
 *  empty out; `transactions` also governs cascaded spans. */
type DataType = 'events' | 'transactions' | 'logs';

const TYPE_OPTIONS: { key: DataType; label: string }[] = [
  { key: 'events', label: 'Errors' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'logs', label: 'Logs' },
];

export function StorageCleanup({ projects }: StorageCleanupProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState('90');
  const [scope, setScope] = useState(ALL_SCOPE);
  const [selected, setSelected] = useState<Record<DataType, boolean>>({
    events: true,
    transactions: true,
    logs: true,
  });
  const [preview, setPreview] = useState<CleanupCounts | null>(null);

  const olderThanDays = Number(period);
  const projectId = scope === ALL_SCOPE ? undefined : Number(scope);

  // Any change to period/scope/selection invalidates a stale preview — the
  // breakdown only ever reflects the exact options it was run with.
  const resetPreview = () => setPreview(null);

  const noneSelected =
    !selected.events && !selected.transactions && !selected.logs;

  const toggle = (key: DataType) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
    resetPreview();
  };

  const handlePreview = () => {
    startTransition(async () => {
      try {
        const counts = await previewStorageCleanup({
          older_than_days: olderThanDays,
          project_id: projectId,
          include_events: selected.events,
          include_transactions: selected.transactions,
          include_logs: selected.logs,
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
          include_events: selected.events,
          include_transactions: selected.transactions,
          include_logs: selected.logs,
        });
        toast.success(summarizeRemoved(counts));
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

  // Breakdown rows for the categories the preview was run with — only the
  // selected ones, so it never claims to touch data the selection spared.
  const previewLines = preview ? buildLines(preview, selected) : [];
  const nothingToDelete =
    preview !== null && previewLines.every((l) => l.count === 0);

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="size-4" />
          Clean up old data
        </CardTitle>
        <CardDescription>
          Permanently delete the selected data older than the chosen period.
          Preview first — this cannot be undone.
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
        </div>

        {/* Sober inline selection — pick the categories, no numbers until the
            dry-run actually runs. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-sm font-medium text-muted-foreground">
            Data
          </span>
          {TYPE_OPTIONS.map((t) => (
            <label
              key={t.key}
              className="flex items-center gap-2 text-sm cursor-pointer select-none"
            >
              <Checkbox
                checked={selected[t.key]}
                onCheckedChange={() => toggle(t.key)}
                disabled={isPending}
              />
              {t.label}
            </label>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handlePreview}
          disabled={isPending || noneSelected}
        >
          {isPending ? 'Working…' : 'Preview'}
        </Button>

        {preview !== null &&
          (nothingToDelete ? (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Nothing matches this selection{' '}
                {periodLabel(period).toLowerCase()} for {scopeLabel(scope)} —
                there's nothing to delete.
              </p>
            </div>
          ) : (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">This cleanup would remove</p>
              <dl className="text-sm">
                {previewLines.map((line) => (
                  <div
                    key={line.label}
                    className="flex items-center justify-between border-b py-1.5 last:border-b-0"
                  >
                    <dt className="text-muted-foreground">{line.label}</dt>
                    <dd className="tabular-nums font-medium">
                      {line.count.toLocaleString()}
                    </dd>
                  </div>
                ))}
              </dl>

              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="destructive" disabled={isPending} />}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete permanently
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="size-5 text-destructive" />
                      Delete {totalRows(previewLines).toLocaleString()} rows?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the selected data{' '}
                      {periodLabel(period).toLowerCase()} for{' '}
                      {scopeLabel(scope)}. This action cannot be undone.
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
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

interface PreviewLine {
  label: string;
  count: number;
}

/** Breakdown rows for the categories the selection includes. `spans` and
 *  `empty issues` ride along with their governing category (transactions and
 *  events respectively). */
function buildLines(
  counts: CleanupCounts,
  selected: Record<DataType, boolean>,
): PreviewLine[] {
  const lines: PreviewLine[] = [];
  if (selected.events) {
    lines.push({ label: 'Errors', count: counts.events });
    lines.push({ label: 'Empty issues', count: counts.issues_removed });
  }
  if (selected.transactions) {
    lines.push({ label: 'Transactions', count: counts.transactions });
    lines.push({ label: 'Spans', count: counts.spans });
  }
  if (selected.logs) {
    lines.push({ label: 'Logs', count: counts.logs });
  }
  return lines;
}

function totalRows(lines: PreviewLine[]): number {
  return lines.reduce((sum, l) => sum + l.count, 0);
}

/** Success toast text after an executed cleanup — categories the server reports
 *  as zero (spared or empty) simply don't show up. */
function summarizeRemoved(counts: CleanupCounts): string {
  const parts: string[] = [];
  if (counts.events) parts.push(`${counts.events.toLocaleString()} errors`);
  if (counts.transactions)
    parts.push(`${counts.transactions.toLocaleString()} transactions`);
  if (counts.spans) parts.push(`${counts.spans.toLocaleString()} spans`);
  if (counts.logs) parts.push(`${counts.logs.toLocaleString()} logs`);
  if (counts.issues_removed)
    parts.push(`${counts.issues_removed.toLocaleString()} empty issues`);
  return parts.length > 0
    ? `Removed ${parts.join(', ')}`
    : 'Nothing matched — no data removed';
}
