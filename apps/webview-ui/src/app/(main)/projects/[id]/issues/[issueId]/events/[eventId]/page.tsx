import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  getEventDetail,
  getEventNavigation,
} from '@/features/event/api/queries';
import {
  type EventJumpTarget,
  eventJumpTargets,
} from '@/features/event/lib/event-jumps';
import {
  readEventPayload,
  splitIssueTitle,
} from '@/features/event/lib/event-payload';
import {
  getIssue,
  getIssueActivity,
  getIssueAggregates,
  getIssueStats,
} from '@/features/issue/api/queries';
import { TagDistribution } from '@/features/issue/ui/components/tag-distribution';
import { getProject } from '@/features/project/api/queries';
import { CollapsibleRail } from '@/shared/ui/components/collapsible-rail';
import { EventChart } from '@/shared/ui/components/event-chart';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { EventHeader } from './_components/event-header';
import { EventIdentityBar } from './_components/event-identity-bar';
import { EventRail } from './_components/event-rail';
import { EventSections } from './_components/event-sections';

interface EventPageProps {
  params: Promise<{ id: string; issueId: string; eventId: string }>;
}

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const t = await getTranslations('projectPages');
  const { id, issueId, eventId } = await params;
  const projectId = parseInt(id, 10);

  const [project, event] = await Promise.all([
    getProject(projectId),
    getEventDetail(projectId, issueId, eventId),
  ]);

  if (!project.success || !event.success) {
    return { title: t('event.meta.eventNotFound') };
  }

  return {
    title: t('projectTitle', { project: project.data.name }),
    description: t('event.meta.description'),
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
  const t = await getTranslations('projectPages');
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
      <LoadFailure error={projectResult.error} title={t('loadProjectFailed')} />
    );
  }
  if (!issueResult.success) {
    return (
      <LoadFailure error={issueResult.error} title={t('loadIssueFailed')} />
    );
  }
  if (!eventResult.success) {
    return (
      <LoadFailure error={eventResult.error} title={t('event.loadFailed')} />
    );
  }
  if (!navigationResult.success) {
    return (
      <LoadFailure
        error={navigationResult.error}
        title={t('event.loadNavigationFailed')}
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

  // One entry per section the event actually has. Labelled here rather than
  // in `eventJumpTargets` so every message key stays a literal the
  // message-keys architecture rule can check.
  const SECTION_LABELS: Record<EventJumpTarget, string> = {
    highlights: t('event.sectionHighlights'),
    stacktrace: t('event.sectionStackTrace'),
    breadcrumbs: t('event.sectionBreadcrumbs'),
    tags: t('event.sectionTags'),
    context: t('event.sectionContext'),
  };
  const jumps = eventJumpTargets(has).map((id) => ({
    id,
    label: SECTION_LABELS[id],
  }));

  const rail = (
    <EventRail
      projectId={projectId}
      issueId={issueId}
      issue={issue}
      activity={activity}
    />
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
      <EventHeader
        issue={issue}
        projectId={projectId}
        titleType={titleType}
        message={message}
        levelText={levelText}
        userCount={userCount}
      />

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
                      {t('event.events')}
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      {compact(total30d)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('event.users')}
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
                      {t('event.noEventData')}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {t('event.tags')}
                </h3>
                {aggregates && aggregates.tags.length > 0 ? (
                  <TagDistribution tags={aggregates.tags.slice(0, 5)} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t('event.noTags')}
                  </p>
                )}
              </div>
            </div>

            <EventIdentityBar
              projectId={projectId}
              issueId={issueId}
              event={event}
              navigation={navigation}
              jumps={jumps}
            />

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
        <CollapsibleRail title={t('event.details')}>{rail}</CollapsibleRail>
      </div>
    </div>
  );
}
