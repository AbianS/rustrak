import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProject } from '@/actions/projects';
import { getReleaseHealth } from '@/actions/sessions';
import { ReleasesList } from './releases-list';

interface ReleasesPageProps {
  params: Promise<{ id: string }>;
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

export default async function ReleasesPage({ params }: ReleasesPageProps) {
  const { id } = await params;
  const projectId = parseInt(id, 10);

  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const releaseHealth = await getReleaseHealth(projectId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-auto">
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">Releases</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Session health per release for {project.name}
        </p>
      </div>

      <div className="flex-1 w-full px-4 md:px-8 py-4 md:py-6">
        <ReleasesList projectId={projectId} initialHealth={releaseHealth} />
      </div>
    </div>
  );
}
