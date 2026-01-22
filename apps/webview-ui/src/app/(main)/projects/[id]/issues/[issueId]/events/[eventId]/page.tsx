import { format } from 'date-fns';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEventDetail, getEventNavigation } from '@/actions/events';
import { getIssue } from '@/actions/issues';
import { getProject } from '@/actions/projects';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { normalizeBreadcrumbs, parseEventData } from '@/lib/event-schema';
import { IssueActions } from '../../issue-actions';
import { Breadcrumbs } from './breadcrumbs';
import { EventContext } from './event-context';
import { EventDetails } from './event-details';
import { EventNavigationBar } from './event-navigation';
import { EventTags } from './event-tags';
import { RawJson } from './raw-json';
import { StackTrace } from './stack-trace';

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

  if (!project || !event) {
    return { title: 'Event Not Found | Rustrak' };
  }

  return {
    title: `Event ${event.event_id.slice(0, 8)} | ${project.name} | Rustrak`,
    description: `Event details`,
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { id, issueId, eventId } = await params;
  const projectId = parseInt(id, 10);

  const [project, issue, event, navigation] = await Promise.all([
    getProject(projectId),
    getIssue(projectId, issueId),
    getEventDetail(projectId, issueId, eventId),
    getEventNavigation(projectId, issueId, eventId),
  ]);

  if (!project || !issue || !event) {
    notFound();
  }

  // Extract and validate data from Sentry event JSON
  // Uses Zod schemas to ensure type safety and prevent XSS from malformed data
  const eventData = event.data as Record<string, unknown>;
  const {
    exception,
    breadcrumbs: rawBreadcrumbs,
    contexts,
    tags,
    user,
  } = parseEventData(eventData);

  // Normalize breadcrumbs to always be an array
  const breadcrumbs = normalizeBreadcrumbs(rawBreadcrumbs);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <header className="shrink-0 bg-background border-b">
        <div className="max-w-[1600px] w-full mx-auto px-8 py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {issue.is_resolved && (
                  <Badge
                    variant="outline"
                    className="text-green-600 border-green-600"
                  >
                    Resolved
                  </Badge>
                )}
                {issue.is_muted && (
                  <Badge
                    variant="outline"
                    className="text-yellow-600 border-yellow-600"
                  >
                    Muted
                  </Badge>
                )}
                {event.level && (
                  <Badge
                    variant={
                      event.level === 'error' ? 'destructive' : 'secondary'
                    }
                  >
                    {event.level}
                  </Badge>
                )}
                {event.environment && (
                  <Badge variant="outline">{event.environment}</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {format(new Date(event.timestamp), 'PPpp')}
                </span>
                {event.release && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {event.release}
                  </span>
                )}
              </div>

              <h1 className="text-xl font-extrabold tracking-tight truncate">
                {issue.title}
              </h1>

              {issue.value && (
                <p className="text-sm text-muted-foreground font-mono truncate">
                  {issue.value}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-3 shrink-0">
              <EventNavigationBar
                projectId={projectId}
                issueId={issueId}
                navigation={navigation}
              />
              <IssueActions issue={issue} projectId={projectId} />
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1600px] w-full mx-auto px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Main Content */}
            <div className="lg:col-span-8">
              <Tabs defaultValue="stacktrace">
                <TabsList>
                  <TabsTrigger value="stacktrace">Stack Trace</TabsTrigger>
                  <TabsTrigger value="breadcrumbs">Breadcrumbs</TabsTrigger>
                  <TabsTrigger value="details">Event Details</TabsTrigger>
                  <TabsTrigger value="tags">Tags</TabsTrigger>
                  <TabsTrigger value="context">Context</TabsTrigger>
                  <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                </TabsList>

                <TabsContent value="stacktrace" className="mt-6">
                  <StackTrace exception={exception} />
                </TabsContent>

                <TabsContent value="breadcrumbs" className="mt-6">
                  <Breadcrumbs breadcrumbs={breadcrumbs} />
                </TabsContent>

                <TabsContent value="details" className="mt-6">
                  <EventDetails event={event} />
                </TabsContent>

                <TabsContent value="tags" className="mt-6">
                  <EventTags tags={tags} />
                </TabsContent>

                <TabsContent value="context" className="mt-6">
                  <EventContext contexts={contexts} user={user} />
                </TabsContent>

                <TabsContent value="raw" className="mt-6">
                  <RawJson data={eventData} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-4 space-y-6">
              {/* Issue Stats */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Issue Statistics
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">
                      Total Events
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {issue.event_count.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">
                      First Seen
                    </p>
                    <p className="text-sm font-semibold">
                      {new Date(issue.first_seen).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {tags && Object.keys(tags).length > 0 && (
                <div className="bg-card rounded-xl border p-6 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tags).map(([key, value]) => (
                      <span
                        key={key}
                        className="px-2 py-1 bg-muted text-[10px] font-mono border rounded-sm"
                      >
                        {key}:{value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* User */}
              {user && (
                <div className="bg-card rounded-xl border p-6 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    User
                  </h4>
                  <div className="space-y-2">
                    {user.id && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">ID</span>
                        <span className="font-mono">{user.id}</span>
                      </div>
                    )}
                    {user.email && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-mono text-xs truncate ml-2">
                          {user.email}
                        </span>
                      </div>
                    )}
                    {user.ip_address && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">IP</span>
                        <span className="font-mono">{user.ip_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Event Details */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Event Details
                </h4>
                <div className="space-y-2">
                  {event.platform && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform</span>
                      <span className="font-mono">{event.platform}</span>
                    </div>
                  )}
                  {event.environment && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Environment</span>
                      <span className="font-mono">{event.environment}</span>
                    </div>
                  )}
                  {event.release && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Release</span>
                      <span className="font-mono text-xs">{event.release}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Event ID</span>
                    <span className="font-mono text-[10px]">
                      {event.event_id.slice(0, 8)}...
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
