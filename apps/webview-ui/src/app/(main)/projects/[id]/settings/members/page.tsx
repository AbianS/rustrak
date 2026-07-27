import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/actions/auth';
import { listProjectMembers } from '@/actions/members';
import { getProject } from '@/actions/projects';
import { LoadFailure } from '@/components/load-failure';
import { ServiceUnavailable } from '@/components/service-unavailable';
import { loadAll } from '@/lib/results';
import { MembersSettings } from './members-settings';

interface MembersSettingsPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Project Members | Rustrak',
};

export default async function MembersSettingsPage({
  params,
}: MembersSettingsPageProps) {
  const { id } = await params;
  const projectId = parseInt(id, 10);
  // Concurrent, but each answer still gets its own branch. `listProjectMembers`
  // used to `.catch(() => [])`, so an outage rendered "this project has no
  // members" next to a permission verdict computed from that same empty list.
  const [loaded, session] = await Promise.all([
    loadAll([getProject(projectId), listProjectMembers(projectId)]),
    getCurrentUser(),
  ]);

  // The old code fell straight from a `null` user into `canManage: false`, so
  // an API outage silently rendered a read-only members page that looked
  // exactly like the one a non-admin sees. Neither a redirect nor a silent
  // demotion is right here.
  if (session.state === 'anonymous') {
    redirect('/auth/login');
  }

  if (session.state === 'unavailable') {
    return <ServiceUnavailable error={session.error} />;
  }

  if (!loaded.success) {
    return (
      <LoadFailure
        error={loaded.error}
        title="Could not load project members"
      />
    );
  }

  const [, members] = loaded.data;

  const currentUser = session.user;
  const currentMembership = members.find(
    (member) => member.user_id === currentUser.id,
  );
  const canManageMembers =
    currentUser.role === 'admin' || currentMembership?.role === 'admin';

  return (
    <MembersSettings
      projectId={projectId}
      members={members}
      currentUserId={currentUser.id}
      canManage={canManageMembers}
    />
  );
}
