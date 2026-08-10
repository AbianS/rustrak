import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getProject } from '@/features/project/api/queries';
import { GeneralSettingsForm } from '@/features/project/ui/components/general-settings-form/general-settings-form';
import { LoadFailure } from '@/shared/ui/components/load-failure';

interface GeneralSettingsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('general.meta.title') };
}

export default async function GeneralSettingsPage({
  params,
}: GeneralSettingsPageProps) {
  const t = await getTranslations('settings');
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return <LoadFailure error={project.error} title={t('loadProjectFailed')} />;
  }

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          {t('general.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('general.subtitle')}</p>
      </div>

      <GeneralSettingsForm project={project.data} />
    </>
  );
}
