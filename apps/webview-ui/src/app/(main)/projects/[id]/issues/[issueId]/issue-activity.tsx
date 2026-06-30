'use client';

import type { ActivityEntry } from '@rustrak/client';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addIssueComment } from '@/actions/issues';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface IssueActivityProps {
  projectId: number;
  issueId: string;
  activity: ActivityEntry[];
}

const STATUS_LABELS: Record<string, string> = {
  resolved: 'marked this issue as resolved',
  unresolved: 'reopened this issue',
  ignored: 'muted this issue',
};

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
function describe(entry: ActivityEntry): string {
  const d = parseData(entry.data);
  switch (entry.type) {
    case 'set_status': {
      const status = typeof d.status === 'string' ? d.status : '';
      return STATUS_LABELS[status] ?? `changed status to ${status}`;
    }
    case 'set_priority':
      return `set priority to ${d.priority ?? '—'}`;
    case 'regression':
      return 'detected a regression';
    case 'first_seen':
      return 'first saw this issue';
    default:
      return entry.type.replace(/_/g, ' ');
  }
}

export function IssueActivity({
  projectId,
  issueId,
  activity,
}: IssueActivityProps) {
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
      await addIssueComment(projectId, issueId, body);
      setText('');
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Activity</h3>

      <div className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Leave a comment..."
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
              Comment
            </Button>
          </div>
        </form>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No activity yet.
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
                      <p className="text-muted-foreground">{describe(entry)}</p>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {formatDistanceToNow(new Date(entry.created_at), {
                        addSuffix: true,
                      })}
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
