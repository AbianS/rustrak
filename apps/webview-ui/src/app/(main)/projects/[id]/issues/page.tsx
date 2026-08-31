import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { listIssues } from '@/features/issue/api/queries';
import { IssuesList } from '@/features/issue/ui/components/issues-list/issues-list';
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
  const t = await getTranslations('projectPages');
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return { title: t('projectNotFound') };
  }

  return {
    title: t('projectTitle', { project: project.data.name }),
    description: t('issues.meta.description', {
      project: project.data.name,
    }),
  };
}

export default async function IssuesPage({
  params,
  searchParams,
}: IssuesPageProps) {
  const t = await getTranslations('projectPages');
  const { id } = await params;
  const { filter = 'open', page = '1' } = await searchParams;
  const projectId = parseInt(id, 10);
  const currentPage = parseInt(page, 10) || 1;

  const loaded = await loadAll([
    getProject(projectId),
    listIssues(projectId, {
      q: `is:${filter}`,
      page: currentPage,
      per: 20,
      sort: '-last_seen',
    }),
  ]);

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('issues.loadFailed')} />;
  }

  const [project, issuesResponse] = loaded.data;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">{t('issues.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('issues.subtitle', { project: project.name })}
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
