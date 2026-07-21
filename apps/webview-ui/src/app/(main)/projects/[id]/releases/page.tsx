import { Rocket } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject } from '@/actions/projects';
import { getReleaseHealth } from '@/actions/sessions';
import { ReleasesList } from './releases-list';

interface ReleasesPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; period?: string }>;
}

export async function generateMetadata({
  params,
}: ReleasesPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `Releases | ${project.name} | Rustrak`,
    description: `Release health for ${project.name}`,
  };
}

export default async function ReleasesPage({
  params,
  searchParams,
}: ReleasesPageProps) {
  const { id } = await params;
  const { page = '1', period } = await searchParams;
  const projectId = parseInt(id, 10);
  const currentPage = Math.max(1, parseInt(page, 10) || 1);

  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  // No catch: a fetch/auth failure must surface to the error boundary, not be
  // disguised as the "no releases yet" onboarding state.
  const health = await getReleaseHealth(projectId, {
    page: currentPage,
    per_page: 20,
    period: period || undefined,
  });

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
