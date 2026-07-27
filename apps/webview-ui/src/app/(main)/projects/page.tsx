import type { Metadata } from 'next';
import { getProjects } from '@/actions/projects';
import { LoadFailure } from '@/components/load-failure';
import { ProjectsHeader } from './projects-header';
import { ProjectsList } from './projects-list';

export const metadata: Metadata = {
  title: 'Projects | Rustrak',
  description: 'Manage your Rustrak projects',
};

/**
 * Window for the per-row stats.
 *
 * Fixed rather than user-selectable: this page answers "which project should
 * I look at", and `/projects/[id]` already owns choosing a time range.
 */
const STATS_PERIOD = '24h';

interface ProjectsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const { page = '1' } = await searchParams;
  const currentPage = parseInt(page, 10) || 1;

  // One request, stats included: the server aggregates the whole page in two
  // queries. Asking per row would be 20 round trips for a table that renders
  // above the fold.
  const projectsResponse = await getProjects({
    page: currentPage,
    per_page: 20,
    stats_period: STATS_PERIOD,
  });

  if (!projectsResponse.success) {
    return (
      <LoadFailure
        error={projectsResponse.error}
        title="Could not load projects"
        notFoundOnMissing={false}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header section - fixed */}
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <ProjectsHeader />
      </div>

      {/* Content section - grows and handles overflow */}
      <div className="flex-1 overflow-hidden w-full px-4 md:px-8 py-4 md:py-6">
        <ProjectsList
          initialProjects={projectsResponse.data}
          currentPage={currentPage}
        />
      </div>
    </div>
  );
}
