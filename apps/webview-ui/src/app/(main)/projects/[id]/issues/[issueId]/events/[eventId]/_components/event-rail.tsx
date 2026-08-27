import type { ActivityEntry, Issue } from '@rustrak/client';
import { getFormatter, getTranslations } from 'next-intl/server';
import { IssueActivity } from '@/features/issue/ui/components/issue-activity';

interface EventRailProps {
  projectId: number;
  issueId: string;
  issue: Issue;
  activity: ActivityEntry[];
}

/**
 * The side rail: when the issue was last and first seen, and what has
 * happened to it since.
 *
 * About the **issue**, not the event being read. That is why it sits beside
 * the page rather than in it: the event is one sample, and these are the facts
 * that put it in context.
 */
export async function EventRail({
  projectId,
  issueId,
  issue,
  activity,
}: EventRailProps) {
  const t = await getTranslations('projectPages');
  const format = await getFormatter();

  return (
    <>
      <div className="p-4 space-y-1.5 border-b">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{t('event.lastSeen')}</span>
          <span title={format.dateTime(new Date(issue.last_seen), 'precise')}>
            {format.relativeTime(new Date(issue.last_seen))}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{t('event.firstSeen')}</span>
          <span title={format.dateTime(new Date(issue.first_seen), 'precise')}>
            {format.relativeTime(new Date(issue.first_seen))}
          </span>
        </div>
        {issue.last_release && (
          <p className="text-xs text-muted-foreground truncate pt-1">
            {t.rich('event.inRelease', {
              release: issue.last_release,
              rel: (chunks) => <span className="font-mono">{chunks}</span>,
            })}
          </p>
        )}
      </div>

      <div className="p-4">
        <IssueActivity
          projectId={projectId}
          issueId={issueId}
          activity={activity}
        />
      </div>
    </>
  );
}
