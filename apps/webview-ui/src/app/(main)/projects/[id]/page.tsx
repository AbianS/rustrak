import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listIssues } from '@/actions/issues';
import { getProject } from '@/actions/projects';
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

  // Fetch issues with offset-based pagination
  const issuesResponse = await listIssues(projectId, {
    filter: filter as 'open' | 'resolved' | 'muted' | 'all',
    page: currentPage,
    per_page: 20,
    sort: 'last_seen',
    order: 'desc',
  });

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header section - fixed */}
      <div className="shrink-0 max-w-[1600px] w-full mx-auto px-8 py-6 border-b">
        <ProjectHeader project={project} />
      </div>

      {/* Content section - grows and handles overflow */}
      <div className="flex-1 overflow-hidden max-w-[1600px] w-full mx-auto px-8 py-6">
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
