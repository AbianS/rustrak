import { Timer } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listMonitors } from '@/actions/monitors';
import { getProject } from '@/actions/projects';
import { MonitorsList } from './monitors-list';

interface CronsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: CronsPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `Crons | ${project.name} | Rustrak`,
    description: `Cron monitors for ${project.name}`,
  };
}

export default async function CronsPage({ params }: CronsPageProps) {
  const { id } = await params;
  const projectId = parseInt(id, 10);

  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  // No catch: a fetch/auth failure must surface to the error boundary, not be
  // disguised as the "no monitors yet" onboarding state.
  const monitors = await listMonitors(projectId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="shrink-0 max-w-400 w-full mx-auto px-4 md:px-8 py-4 md:py-6 border-b">
        <h1 className="text-lg font-semibold">Crons</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Scheduled job monitors for {project.name}
        </p>
      </div>

      <div className="flex-1 overflow-hidden max-w-400 w-full mx-auto px-4 md:px-8 py-4 md:py-6">
        {monitors.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-full text-center">
            <Timer className="size-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-1">No monitors yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Send check-ins from your SDK&apos;s cron monitoring (e.g.{' '}
              <code>Sentry.captureCheckIn(...)</code>) and your scheduled jobs
              will appear here automatically.
            </p>
          </div>
        ) : (
          <MonitorsList projectId={projectId} monitors={monitors} />
        )}
      </div>
    </div>
  );
}
