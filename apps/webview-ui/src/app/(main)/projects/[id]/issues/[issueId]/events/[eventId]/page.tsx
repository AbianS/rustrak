import { formatDistanceToNow } from 'date-fns';
import { CircleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getEventDetail,
  getEventNavigation,
} from '@/features/event/api/queries';
import {
  readEventPayload,
  splitIssueTitle,
} from '@/features/event/lib/event-payload';
import { EventNavigationBar } from '@/features/event/ui/components/event-navigation';
import {
  getIssue,
  getIssueActivity,
  getIssueAggregates,
  getIssueStats,
} from '@/features/issue/api/queries';
import { IssueActions } from '@/features/issue/ui/components/issue-actions';
import { IssueActivity } from '@/features/issue/ui/components/issue-activity';
import { StatusIndicator } from '@/features/issue/ui/components/issue-indicators';
import { TagDistribution } from '@/features/issue/ui/components/tag-distribution';
import { getProject } from '@/features/project/api/queries';
import { cn } from '@/shared/lib/utils';
import { CollapsibleRail } from '@/shared/ui/components/collapsible-rail';
import { EventChart } from '@/shared/ui/components/event-chart';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { EventSections } from './_components/event-sections';

interface EventPageProps {
  params: Promise<{ id: string; issueId: string; eventId: string }>;
}

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const { id, issueId, eventId } = await params;
  const projectId = parseInt(id, 10);

  const [project, event] = await Promise.all([
    getProject(projectId),
    getEventDetail(projectId, issueId, eventId),
  ]);

  if (!project.success || !event.success) {
    return { title: 'Event Not Found | Rustrak' };
  }

  return {
    title: `${project.data.name} | Rustrak`,
    description: 'Event details',
  };
}

const LEVEL_TEXT: Record<string, string> = {
  fatal: 'text-red-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-sky-500',
  debug: 'text-muted-foreground',
};

const compact = (n: number) =>
  Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);

export default async function EventPage({ params }: EventPageProps) {
  const { id, issueId, eventId } = await params;
  const projectId = parseInt(id, 10);

  const [
    projectResult,
    issueResult,
    eventResult,
    navigationResult,
    aggregatesResult,
    statsResult,
    activityResult,
  ] = await Promise.all([
    getProject(projectId),
    getIssue(projectId, issueId),
    getEventDetail(projectId, issueId, eventId),
    getEventNavigation(projectId, issueId, eventId),
    getIssueAggregates(projectId, issueId),
    getIssueStats(projectId, issueId, '30d'),
    getIssueActivity(projectId, issueId),
  ]);

  // The four the page cannot render without.
  if (!projectResult.success) {
    return (
      <LoadFailure error={projectResult.error} title="Could not load project" />
    );
  }
  if (!issueResult.success) {
    return (
      <LoadFailure error={issueResult.error} title="Could not load issue" />
    );
  }
  if (!eventResult.success) {
    return (
      <LoadFailure error={eventResult.error} title="Could not load event" />
    );
  }
  if (!navigationResult.success) {
    return (
      <LoadFailure
        error={navigationResult.error}
        title="Could not load the events in this issue"
      />
    );
  }

  const issue = issueResult.data;
  const event = eventResult.data;
  const navigation = navigationResult.data;

  // The three that decorate the page. Each already degraded on failure before
  // the Result conversion; the degradation is now written out rather than
  // hidden behind a `.catch()`, and it stays deliberate: an issue with no tags
  // and an aggregates endpoint that failed genuinely render the same panel, and
  // neither is worth taking the event view down for.
  const aggregates = aggregatesResult.success ? aggregatesResult.data : null;
  const stats30d = statsResult.success ? statsResult.data : null;
  const activity = activityResult.success ? activityResult.data : [];

  const eventData = event.data as Record<string, unknown>;
  const payload = readEventPayload(eventData);
  const { has } = payload;
  const { type: titleType, message } = splitIssueTitle(
    issue.title,
    issue.value,
  );
  const levelText =
    LEVEL_TEXT[(event.level ?? '').toLowerCase()] ?? 'text-muted-foreground';

  const userCount = aggregates?.user_count ?? 0;
  const total30d = stats30d?.data.reduce((s, [, c]) => s + c, 0) ?? 0;

  // "Jump to" anchors — only for sections that exist.
  const jumps = [
    { id: 'highlights', label: 'Highlights' },
    has.stackTrace && { id: 'stacktrace', label: 'Stack Trace' },
    has.breadcrumbs && { id: 'breadcrumbs', label: 'Breadcrumbs' },
    has.tags && { id: 'tags', label: 'Tags' },
    (has.contexts || has.modules || has.user) && {
      id: 'context',
      label: 'Context',
    },
  ].filter(Boolean) as { id: string; label: string }[];

  const rail = (
    <>
      <div className="p-4 space-y-1.5 border-b">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Last seen</span>
          <span title={new Date(issue.last_seen).toLocaleString()}>
            {formatDistanceToNow(new Date(issue.last_seen), {
              addSuffix: true,
            })}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">First seen</span>
          <span title={new Date(issue.first_seen).toLocaleString()}>
            {formatDistanceToNow(new Date(issue.first_seen), {
              addSuffix: true,
            })}
          </span>
        </div>
        {issue.last_release && (
          <p className="text-xs text-muted-foreground truncate pt-1">
            in release <span className="font-mono">{issue.last_release}</span>
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

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
      {/* Header */}
      <header className="shrink-0 bg-card border-b">
        <div className="w-full px-4 md:px-8 py-3 space-y-1.5">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <Link
              href={`/projects/${projectId}/issues`}
              className="hover:text-foreground transition-colors"
            >
              Issues
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-mono text-foreground truncate">
              {issue.short_id}
            </span>
          </nav>

          <div className="flex items-start justify-between gap-6">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate min-w-0">
              {titleType}
            </h1>
            <div className="flex items-start gap-4 sm:gap-8 shrink-0">
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Events (total)
                </p>
                <p className="text-xl font-semibold tabular-nums leading-tight">
                  {compact(issue.event_count)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Users
                </p>
                <p className="text-xl font-semibold tabular-nums leading-tight">
                  {compact(userCount)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm text-muted-foreground min-w-0">
            <CircleAlert className={cn('size-4 shrink-0 mt-0.5', levelText)} />
            <p className="truncate font-mono text-foreground/90">{message}</p>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <StatusIndicator issue={issue} />
            {issue.culprit && (
              <span className="font-mono truncate">{issue.culprit}</span>
            )}
          </div>
        </div>

        {/* Workflow toolbar — same elevated band as the header */}
        <div className="border-t">
          <div className="w-full px-4 md:px-8 py-2">
            <IssueActions issue={issue} projectId={projectId} />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="w-full px-4 md:px-8 py-5 space-y-5">
            {/* Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
              <div className="rounded-lg border bg-card p-4 flex gap-5">
                <div className="shrink-0 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Events
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      {compact(total30d)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Users
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      {compact(userCount)}
                    </p>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {stats30d && stats30d.data.length > 0 ? (
                    <EventChart data={stats30d.data} />
                  ) : (
                    <div className="h-[130px] flex items-center justify-center text-xs text-muted-foreground">
                      No event data
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Tags
                </h3>
                {aggregates && aggregates.tags.length > 0 ? (
                  <TagDistribution tags={aggregates.tags.slice(0, 5)} />
                ) : (
                  <p className="text-xs text-muted-foreground">No tags</p>
                )}
              </div>
            </div>

            {/* Event nav + identity + jump-to (sticks to the top on scroll, sm+) */}
            <div className="sm:sticky sm:top-0 sm:z-20 -mx-4 md:-mx-8 border-b bg-background px-4 md:px-8 pt-1 pb-3 space-y-3 sm:space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  <span className="font-semibold">Events</span>{' '}
                  <span className="text-muted-foreground">in this issue</span>
                </p>
                <EventNavigationBar
                  projectId={projectId}
                  issueId={issueId}
                  navigation={navigation}
                />
              </div>

              <div className="flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span>
                    ID:{' '}
                    <span className="font-mono text-foreground">
                      {event.event_id.slice(0, 8)}
                    </span>
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>
                    {formatDistanceToNow(new Date(event.timestamp), {
                      addSuffix: true,
                    })}
                  </span>
                  {event.platform && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                      {event.platform}
                    </span>
                  )}
                  {event.environment && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                      {event.environment}
                    </span>
                  )}
                </div>
                {jumps.length > 0 && (
                  <div className="flex items-center gap-3 flex-wrap shrink-0">
                    <span>Jump to:</span>
                    {jumps.map((j) => (
                      <a
                        key={j.id}
                        href={`#${j.id}`}
                        className="hover:text-foreground transition-colors"
                      >
                        {j.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <EventSections
              event={event}
              payload={payload}
              eventData={eventData}
            />

            {/* Right rail (mobile) */}
            <div className="lg:hidden rounded-lg border bg-card overflow-hidden">
              {rail}
            </div>
          </div>
        </main>

        {/* Right rail (desktop, collapsible) */}
        <CollapsibleRail title="Details">{rail}</CollapsibleRail>
      </div>
    </div>
  );
}
