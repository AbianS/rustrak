import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { listAlertRules, listIntegrations } from '@/features/alert/api/queries';
import { AlertsSettings } from '@/features/alert/ui/components/alerts-settings';
import { getProject } from '@/features/project/api/queries';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';

interface AlertsSettingsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('alerts.meta.title') };
}

export default async function AlertsSettingsPage({
  params,
}: AlertsSettingsPageProps) {
  const t = await getTranslations('settings');
  const { id } = await params;
  const projectId = parseInt(id, 10);
  // The two lists used to fall back to `[]`, which drew "no alert rules yet"
  // over an outage and invited the admin to recreate rules that already exist.
  const loaded = await loadAll([
    getProject(projectId),
    listAlertRules(projectId),
    listIntegrations(),
  ]);

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('alerts.loadFailed')} />;
  }

  const [project, alertRules, channels] = loaded.data;

  return (
    <AlertsSettings
      project={project}
      alertRules={alertRules}
      channels={channels}
    />
  );
}
