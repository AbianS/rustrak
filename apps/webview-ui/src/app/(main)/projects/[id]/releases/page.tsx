import { Rocket } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getProject } from '@/features/project/api/queries';
import { getReleaseHealth } from '@/features/release/api/queries';
import { parseReleasePeriod } from '@/features/release/model/session-health';
import { ReleasesList } from '@/features/release/ui/components/releases-list';
import { LoadFailure } from '@/shared/ui/components/load-failure';

interface ReleasesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; period?: string }>;
}

export async function generateMetadata({
  params,
}: ReleasesPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `Releases | ${project.data.name} | Rustrak`,
    description: `Release health for ${project.data.name}`,
  };
}

/** Canonical URL for a page of the releases list, keeping the active window. */
function releasesHref(
  projectId: number,
  page: number,
  period?: string,
): string {
  const params = new URLSearchParams({ page: String(page) });
  if (period) params.set('period', period);
  return `/projects/${projectId}/releases?${params.toString()}`;
}

export default async function ReleasesPage({
  params,
  searchParams,
}: ReleasesPageProps) {
  const { id } = await params;
  const { page, period: rawPeriod } = await searchParams;
  const projectId = parseInt(id, 10);
  const currentPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
  // An unrecognized window would otherwise reach the API, which ignores what
  // it cannot parse and answers with all-time data while no filter button
  // reads as selected. Drop it instead, so the URL and the UI always agree.
  const period = parseReleasePeriod(rawPeriod);

  const projectResult = await getProject(projectId);

  if (!projectResult.success) {
    return (
      <LoadFailure error={projectResult.error} title="Could not load project" />
    );
  }

  const project = projectResult.data;

  // Nothing is swallowed: a fetch/auth failure renders an outage surface rather
  // than the "no releases yet" onboarding state.
  const healthResult = await getReleaseHealth(projectId, {
    page: currentPage,
    per_page: 20,
    period,
  });

  if (!healthResult.success) {
    return (
      <LoadFailure
        error={healthResult.error}
        title="Could not load release health"
        notFoundOnMissing={false}
      />
    );
  }

  const health = healthResult.data;

  // A page past the end still carries a positive total, which would render a
  // nonsensical range ("19961-27 of 27", "Page 999 of 2"). Send the browser to
  // a page that exists; the target is always within range, so this settles in
  // one hop.
  if (health.total_pages > 0 && currentPage > health.total_pages) {
    redirect(releasesHref(projectId, health.total_pages, period));
  }
  if (health.total_pages === 0 && currentPage > 1) {
    redirect(releasesHref(projectId, 1, period));
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">Releases</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Session health per release for {project.name}
        </p>
      </div>

      <div className="flex-1 overflow-hidden w-full px-4 md:px-8 py-4 md:py-6">
        {health.total_count === 0 && !period ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center">
            <Rocket className="size-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-1">No releases yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Send a <code>release</code> attribute with your events or sessions
              to start tracking release health.
            </p>
          </div>
        ) : (
          <ReleasesList
            projectId={projectId}
            initialHealth={health}
            currentPage={currentPage}
            activePeriod={period}
          />
        )}
      </div>
    </div>
  );
}
