import type { Metadata } from 'next';
import { listIssues } from '@/features/issue/api/queries';
import { IssuesList } from '@/features/issue/ui/components/issues-list';
import { getProject } from '@/features/project/api/queries';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';

interface IssuesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; page?: string }>;
}

export async function generateMetadata({
  params,
}: IssuesPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `${project.data.name} | Rustrak`,
    description: `Issues for ${project.data.name}`,
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

  const loaded = await loadAll([
    getProject(projectId),
    listIssues(projectId, {
      filter: filter as 'open' | 'resolved' | 'muted' | 'all',
      page: currentPage,
      per_page: 20,
      sort: 'last_seen',
      order: 'desc',
    }),
  ]);

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title="Could not load issues" />;
  }

  const [project, issuesResponse] = loaded.data;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">Issues</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Open issues for {project.name}
        </p>
      </div>

      <div className="flex-1 overflow-hidden w-full px-4 md:px-8 py-4 md:py-6">
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
