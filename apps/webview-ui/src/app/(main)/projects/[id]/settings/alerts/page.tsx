import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listAlertRules, listIntegrations } from '@/actions/alerts';
import { getProject } from '@/actions/projects';
import { AlertsSettings } from './alerts-settings';

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
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const [alertRules, channels] = await Promise.all([
    listAlertRules(projectId).catch(() => []),
    listIntegrations().catch(() => []),
  ]);

  return (
    <AlertsSettings
      project={project}
      alertRules={alertRules}
      channels={channels}
    />
  );
}
