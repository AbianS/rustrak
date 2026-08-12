import { AlertCircle, ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getIssue } from '@/features/issue/api/queries';
import { getProject } from '@/features/project/api/queries';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { Button } from '@/shared/ui/components/shadcn/button';
import { Card, CardContent } from '@/shared/ui/components/shadcn/card';

interface EmptyEventsPageProps {
  params: Promise<{ id: string; issueId: string }>;
}

export async function generateMetadata({
  params,
}: EmptyEventsPageProps): Promise<Metadata> {
  const t = await getTranslations('projectPages');
  const { id, issueId } = await params;
  const projectId = parseInt(id, 10);

  const [project, issue] = await Promise.all([
    getProject(projectId),
    getIssue(projectId, issueId),
  ]);

  if (!project.success || !issue.success) {
    return { title: t('event.meta.issueNotFound') };
  }

  return {
    title: t('event.meta.noEvents', { issue: issue.data.title }),
  };
}

export default async function EmptyEventsPage({
  params,
}: EmptyEventsPageProps) {
  const t = await getTranslations('projectPages');
  const { id, issueId } = await params;
  const projectId = parseInt(id, 10);

  const loaded = await loadAll([
    getProject(projectId),
    getIssue(projectId, issueId),
  ]);

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('loadIssueFailed')} />;
  }

  const [project, issue] = loaded.data;

  return (
    <div className="w-full px-8 py-10">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={`/projects/${projectId}`} />}
        >
          <ChevronLeft className="mr-1 size-4" />
          {project.name}
        </Button>
      </div>

      {/* Issue Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tighter">
          {issue.title}
        </h1>
      </div>

      {/* Empty State */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="size-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">{t('event.noEventsYet')}</h2>
          <p className="text-muted-foreground max-w-md">
            {t('event.noEventsDescription')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
