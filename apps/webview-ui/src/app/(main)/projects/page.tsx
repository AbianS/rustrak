import type { Metadata } from 'next';
import { getProjects } from '@/actions/projects';
import { ProjectsHeader } from './projects-header';
import { ProjectsList } from './projects-list';

export const metadata: Metadata = {
  title: 'Projects | Rustrak',
  description: 'Manage your Rustrak projects',
};

interface ProjectsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const { page = '1' } = await searchParams;
  const currentPage = parseInt(page, 10) || 1;

  const projectsResponse = await getProjects({
    page: currentPage,
    per_page: 20,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header section - fixed */}
      <div className="shrink-0 max-w-[1600px] w-full mx-auto px-8 py-6 border-b">
        <ProjectsHeader />
      </div>

      {/* Content section - grows and handles overflow */}
      <div className="flex-1 overflow-hidden max-w-[1600px] w-full mx-auto px-8 py-6">
        <ProjectsList
          initialProjects={projectsResponse}
          currentPage={currentPage}
        />
      </div>
    </div>
  );
}
