import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getProject } from '@/features/project/api/queries';
import { ClientKeysSettings } from '@/features/project/ui/components/client-keys-settings';
import { LoadFailure } from '@/shared/ui/components/load-failure';

interface ClientKeysPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('clientKeys.meta.title') };
}

export default async function ClientKeysPage({ params }: ClientKeysPageProps) {
  const t = await getTranslations('settings');
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return <LoadFailure error={project.error} title={t('loadProjectFailed')} />;
  }

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">
          {t('clientKeys.title')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('clientKeys.subtitle')}</p>
      </div>

      <ClientKeysSettings project={project.data} />
    </>
  );
}
