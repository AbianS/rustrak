import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listAlertRules, listIntegrations } from '@/actions/alerts';
import { getCurrentUser } from '@/actions/auth';
import { listIssues } from '@/actions/issues';
import { listProjectMembers } from '@/actions/members';
import { getProject } from '@/actions/projects';
import { getReleaseHealth } from '@/actions/sessions';
import { ProjectHeader } from '../project-header';
import { IssuesList } from './issues-list';

interface IssuesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; page?: string }>;
}

export async function generateMetadata({
  params,
}: IssuesPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `${project.name} | Rustrak`,
    description: `Issues for ${project.name}`,
  };
}

export default async function IssuesPage({
  params,
  searchParams,
}: IssuesPageProps) {
  const { id } = await params;
  const { filter = 'open', page = '1' } = await searchParams;
  const projectId = parseInt(id, 10);
  const currentPage = parseInt(page, 10) || 1;

  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const [
    issuesResponse,
    alertRules,
    channels,
    members,
    currentUser,
    releaseHealth,
  ] = await Promise.all([
    listIssues(projectId, {
      filter: filter as 'open' | 'resolved' | 'muted' | 'all',
      page: currentPage,
      per_page: 20,
      sort: 'last_seen',
      order: 'desc',
    }),
    listAlertRules(projectId).catch(() => []),
    listIntegrations().catch(() => []),
    listProjectMembers(projectId).catch(() => []),
    getCurrentUser(),
    getReleaseHealth(projectId).catch(() => []),
  ]);

  const currentMembership = currentUser
    ? members.find((member) => member.user_id === currentUser.id)
    : undefined;
  const canManageMembers =
    currentUser?.role === 'admin' || currentMembership?.role === 'admin';

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 max-w-400 w-full mx-auto px-4 md:px-8 py-4 md:py-6 border-b">
        <ProjectHeader
          project={project}
          alertRules={alertRules}
          channels={channels}
          members={members}
          currentUserId={currentUser?.id}
          canManageMembers={canManageMembers}
          releaseHealth={releaseHealth}
        />
      </div>

      <div className="flex-1 overflow-hidden max-w-400 w-full mx-auto px-4 md:px-8 py-4 md:py-6">
        <IssuesList
          projectId={projectId}
          initialIssues={issuesResponse}
          currentFilter={filter}
          currentPage={currentPage}
        />
      </div>
    </div>
  );
}
