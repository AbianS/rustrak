'use client';

import type { ActivityEntry } from '@rustrak/client';
import { Loader2, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { addIssueComment } from '@/features/issue/api/mutations';
import { Button } from '@/shared/ui/components/shadcn/button';
import { Textarea } from '@/shared/ui/components/shadcn/textarea';

interface IssueActivityProps {
  projectId: number;
  issueId: string;
  activity: ActivityEntry[];
}

function parseData(data: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** The text body for a comment/note entry. */
function noteText(entry: ActivityEntry): string {
  const text = parseData(entry.data).text;
  return typeof text === 'string' ? text : entry.data;
}

/** A human-readable description of a non-note activity entry. */
function describe(
  entry: ActivityEntry,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const d = parseData(entry.data);
  switch (entry.type) {
    case 'set_status': {
      const status = typeof d.status === 'string' ? d.status : '';
      const keys: Record<string, string> = {
        resolved: 'activity.statusResolved',
        unresolved: 'activity.statusReopened',
        ignored: 'activity.statusMuted',
      };
      return keys[status] ?? t('activity.statusChanged', { status });
    }
    case 'set_priority':
      return t('activity.priorityChanged', {
        priority: String(d.priority ?? '—'),
      });
    case 'set_regression':
      return t('activity.regression');
    case 'first_seen':
      return t('activity.firstSeen');
    default:
      return entry.type.replace(/_/g, ' ');
  }
}

export function IssueActivity({
  projectId,
  issueId,
  activity,
}: IssueActivityProps) {
  const format = useFormatter();
  const t = useTranslations('issues');
  const router = useRouter();
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();

  const entries = [...activity].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) {
      return;
    }
    startTransition(async () => {
      const result = await addIssueComment(projectId, issueId, body);

      if (!result.success) {
        // Keep the text in the box: clearing it on a failure destroys what the
        // user wrote and leaves no trace that anything went wrong.
        toast.error(t('activity.commentFailed'), {
          description: result.error.message,
        });
        return;
      }

      setText('');
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{t('activity.title')}</h3>

      <div className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('activity.placeholder')}
            rows={3}
            disabled={isPending}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !text.trim()}
            >
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <MessageSquare className="mr-2 size-4" />
              )}
              {t('activity.comment')}
            </Button>
          </div>
        </form>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t('activity.empty')}
          </p>
        ) : (
          <ol className="space-y-4">
            {entries.map((entry) => {
              const isNote = entry.type === 'note' || entry.type === 'comment';
              return (
                <li key={entry.id} className="flex gap-3 text-sm">
                  <div className="mt-1.5 size-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                  <div className="min-w-0 flex-1">
                    {isNote ? (
                      <p className="whitespace-pre-wrap break-words">
                        {noteText(entry)}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        {describe(entry, t)}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {format.relativeTime(new Date(entry.created_at))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
