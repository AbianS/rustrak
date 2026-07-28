import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { IssueListCard } from '@/features/issue/ui/issue-list-card';
import { getProject } from '@/features/project/api/queries';
import {
  getAllReleaseHealthRows,
  getNewIssuesForRelease,
} from '@/features/release/api/queries';
import { ReleaseEnvironmentCards } from '@/features/release/ui/release-environment-cards';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/load-failure';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/ui/shadcn/card';

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

  if (!project.success) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `${releaseVersion} | ${project.data.name} | Rustrak`,
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

  // Started here, awaited below. It is kept *out* of `loadAll` because the page
  // does not need it: the environment cards are the release's real content and
  // stand on their own, so its failure degrades this one panel instead of the
  // page -- and it degrades to a failure, never to "no new issues introduced in
  // this release", which is a statement about the release we did not obtain.
  //
  // Kept out of `loadAll` but not out of the same round-trip: awaiting it after
  // `loadAll` resolved would isolate the failure and serialise the request,
  // when only the first was wanted.
  const newIssuesPromise = getNewIssuesForRelease(
    projectId,
    releaseVersion,
    10,
  );

  const loaded = await loadAll([
    getProject(projectId),
    getAllReleaseHealthRows(projectId, releaseVersion),
  ]);

  if (!loaded.success) {
    // The in-flight request above has no consumer now. Take its rejection so a
    // transport-level failure cannot surface as an unhandled rejection.
    void newIssuesPromise.catch(() => undefined);
    return (
      <LoadFailure error={loaded.error} title="Could not load this release" />
    );
  }

  const [project, rows] = loaded.data;

  const newIssues = await newIssuesPromise;

  // No health rows at all means the release in the URL was never reported.
  // Distinct from the failure above, which is why the check stays after it.
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

        {newIssues.success ? (
          <IssueListCard
            projectId={projectId}
            issues={newIssues.data}
            title="New Issues"
            emptyMessage="No new issues introduced in this release"
          />
        ) : (
          <Card size="sm">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                New Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* A 404 from this endpoint alone is not grounds for replacing a
                  release page that already rendered its health cards. */}
              <LoadFailure
                error={newIssues.error}
                title="Could not load new issues"
                notFoundOnMissing={false}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
