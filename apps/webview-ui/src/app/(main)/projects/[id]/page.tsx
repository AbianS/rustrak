import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listAlertRules, listIntegrations } from '@/actions/alerts';
import { getCurrentUser } from '@/actions/auth';
import { listIssues } from '@/actions/issues';
import { listProjectMembers } from '@/actions/members';
import { getProject } from '@/actions/projects';
import { getReleaseHealth } from '@/actions/sessions';
import { IssuesList } from './issues-list';
import { ProjectHeader } from './project-header';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; page?: string }>;
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
    description: `Issues for ${project.name}`,
  };
}

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const { id } = await params;
  const { filter = 'open', page = '1' } = await searchParams;
  const projectId = parseInt(id, 10);
  const currentPage = parseInt(page, 10) || 1;

  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  // Fetch issues, alert, member, release health and user data in parallel
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

  // A user can manage project members if they are a global admin or have the
  // project-level 'admin' role on this project.
  const currentMembership = currentUser
    ? members.find((member) => member.user_id === currentUser.id)
    : undefined;
  const canManageMembers =
    currentUser?.role === 'admin' || currentMembership?.role === 'admin';

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header section - fixed */}
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

      {/* Content section - grows and handles overflow */}
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
