import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getProject } from '@/features/project/api/queries';
import {
  getCurrentUser,
  listProjectMembers,
} from '@/features/user/api/queries';
import { MembersSettings } from '@/features/user/ui/components/members-settings';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { ServiceUnavailable } from '@/shared/ui/components/service-unavailable';

interface MembersSettingsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('members.meta.title') };
}

export default async function MembersSettingsPage({
  params,
}: MembersSettingsPageProps) {
  const t = await getTranslations('settings');
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
    return redirect('/auth/login');
  }

  if (session.state === 'unavailable') {
    return <ServiceUnavailable error={session.error} />;
  }

  if (!loaded.success) {
    return <LoadFailure error={loaded.error} title={t('members.loadFailed')} />;
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
