import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listAlertRules, listIntegrations } from '@/actions/alerts';
import { getCurrentUser } from '@/actions/auth';
import { listIssues } from '@/actions/issues';
import { listProjectMembers } from '@/actions/members';
import { getProject } from '@/actions/projects';
import { getSessionSummary, getSessionTimeseries } from '@/actions/sessions';
import { IssueListCard } from '@/components/issue-list-card';
import { SessionTrendChart } from '@/components/session-trend-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OverviewScoreCards } from './overview-score-cards';
import { ProjectHeader } from './project-header';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `${project.name} | Rustrak`,
    description: `Overview for ${project.name}`,
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const projectId = parseInt(id, 10);

  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const [
    summary,
    timeseries,
    topIssuesResponse,
    alertRules,
    channels,
    members,
    currentUser,
  ] = await Promise.all([
    getSessionSummary(projectId),
    getSessionTimeseries(projectId),
    listIssues(projectId, {
      filter: 'open',
      page: 1,
      per_page: 5,
      sort: 'event_count',
      order: 'desc',
    }),
    listAlertRules(projectId).catch(() => []),
    listIntegrations().catch(() => []),
    listProjectMembers(projectId).catch(() => []),
    getCurrentUser(),
  ]);

  const currentMembership = currentUser
    ? members.find((member) => member.user_id === currentUser.id)
    : undefined;
  const canManageMembers =
    currentUser?.role === 'admin' || currentMembership?.role === 'admin';

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-auto">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <ProjectHeader
          project={project}
          alertRules={alertRules}
          channels={channels}
          members={members}
          currentUserId={currentUser?.id}
          canManageMembers={canManageMembers}
        />
      </div>

      <div className="flex-1 w-full px-4 md:px-8 py-4 md:py-6 flex flex-col gap-4">
        <OverviewScoreCards summary={summary} />
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Crash-Free Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SessionTrendChart data={timeseries} />
          </CardContent>
        </Card>
        <IssueListCard
          projectId={projectId}
          issues={topIssuesResponse.items}
          title="Top Issues"
          emptyMessage="No issues yet"
        />
      </div>
    </div>
  );
}
