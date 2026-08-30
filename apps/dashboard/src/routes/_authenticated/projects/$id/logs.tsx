import { createFileRoute, useLoaderData } from '@tanstack/react-router';
import { PendingScreen } from '../../../../components/project/pending-screen';

export const Route = createFileRoute('/_authenticated/projects/$id/logs')({
  component: Logs,
});

function Logs() {
  const { t } = useLoaderData({ from: '/_authenticated/projects/$id' });
  return <PendingScreen t={t} title="projectOverview.navLogs" />;
}
