import { createFileRoute, useLoaderData } from '@tanstack/react-router';
import { PendingScreen } from '../../../../components/project/pending-screen';

export const Route = createFileRoute('/_authenticated/projects/$id/releases')({
  component: Releases,
});

function Releases() {
  const { t } = useLoaderData({ from: '/_authenticated/projects/$id' });
  return <PendingScreen t={t} title="projectOverview.navReleases" />;
}
