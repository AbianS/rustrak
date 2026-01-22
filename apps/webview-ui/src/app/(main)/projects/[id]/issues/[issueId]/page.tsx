import { notFound, redirect } from 'next/navigation';
import { getLastEvent } from '@/actions/events';
import { getIssue } from '@/actions/issues';

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
  if (!issue) {
    notFound();
  }

  // Get the last event and redirect to it
  const lastEvent = await getLastEvent(projectId, issueId);

  if (lastEvent) {
    redirect(`/projects/${projectId}/issues/${issueId}/events/${lastEvent.id}`);
  }

  // If no events, show empty state
  redirect(`/projects/${projectId}/issues/${issueId}/events/empty`);
}
