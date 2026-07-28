import { redirect } from 'next/navigation';
import { LoadFailure } from '@/components/load-failure';
import { getLastEvent } from '@/features/event/api/queries';
import { getIssue } from '@/features/issue/api/queries';

interface IssuePageProps {
  params: Promise<{ id: string; issueId: string }>;
}

/**
 * Issue page that redirects to the last event.
 * Viewing an issue immediately shows the most recent event.
 */
export default async function IssuePage({ params }: IssuePageProps) {
  const { id, issueId } = await params;
  const projectId = parseInt(id, 10);

  // Verify issue exists
  const issue = await getIssue(projectId, issueId);
  if (!issue.success) {
    return <LoadFailure error={issue.error} title="Could not load issue" />;
  }

  // Get the last event and redirect to it. A failure must not fall through to
  // the empty-state route: "this issue has no events" is a very different
  // claim from "we could not ask".
  const lastEvent = await getLastEvent(projectId, issueId);

  if (!lastEvent.success) {
    return (
      <LoadFailure
        error={lastEvent.error}
        title="Could not load the latest event"
      />
    );
  }

  if (lastEvent.data) {
    redirect(
      `/projects/${projectId}/issues/${issueId}/events/${lastEvent.data.id}`,
    );
  }

  // If no events, show empty state
  redirect(`/projects/${projectId}/issues/${issueId}/events/empty`);
}
