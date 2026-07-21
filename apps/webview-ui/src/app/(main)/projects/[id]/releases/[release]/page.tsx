import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject } from '@/actions/projects';
import { getNewIssuesForRelease } from '@/actions/releases';
import { getAllReleaseHealthRows } from '@/actions/sessions';
import { IssueListCard } from '@/components/issue-list-card';
import { ReleaseEnvironmentCards } from './release-environment-cards';

interface ReleaseDetailPageProps {
  params: Promise<{ id: string; release: string }>;
  searchParams: Promise<{ environment?: string }>;
}

export async function generateMetadata({
  params,
}: ReleaseDetailPageProps): Promise<Metadata> {
  const { id, release } = await params;
  const project = await getProject(parseInt(id, 10));
  const releaseVersion = decodeURIComponent(release);

  if (!project) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `${releaseVersion} | ${project.name} | Rustrak`,
    description: `Release health for ${releaseVersion}`,
  };
}

export default async function ReleaseDetailPage({
  params,
  searchParams,
}: ReleaseDetailPageProps) {
  const { id, release } = await params;
  const { environment } = await searchParams;
  const projectId = parseInt(id, 10);
  const releaseVersion = decodeURIComponent(release);

  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const [rows, newIssues] = await Promise.all([
    getAllReleaseHealthRows(projectId, releaseVersion),
    getNewIssuesForRelease(projectId, releaseVersion, 10),
  ]);

  if (rows.length === 0) {
    notFound();
  }

  const visibleRows = environment
    ? rows.filter((row) => row.environment === environment)
    : rows;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-auto">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold font-mono">{releaseVersion}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Release health for {project.name}
        </p>
      </div>

      <div className="flex-1 w-full px-4 md:px-8 py-4 md:py-6 flex flex-col gap-4">
        <ReleaseEnvironmentCards rows={visibleRows} />

        <IssueListCard
          projectId={projectId}
          issues={newIssues}
          title="New Issues"
          emptyMessage="No new issues introduced in this release"
        />
      </div>
    </div>
  );
}
