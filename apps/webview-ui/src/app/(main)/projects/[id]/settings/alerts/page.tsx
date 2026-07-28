import type { Metadata } from 'next';
import { listAlertRules, listIntegrations } from '@/features/alert/api/queries';
import { AlertsSettings } from '@/features/alert/ui/alerts-settings';
import { getProject } from '@/features/project/api/queries';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/load-failure';

interface AlertsSettingsPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Alert Settings | Rustrak',
};

export default async function AlertsSettingsPage({
  params,
}: AlertsSettingsPageProps) {
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
    return (
      <LoadFailure error={loaded.error} title="Could not load alert settings" />
    );
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
