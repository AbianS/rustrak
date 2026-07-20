import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/actions/auth';
import { listProjectMembers } from '@/actions/members';
import { getProject } from '@/actions/projects';
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
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const [members, currentUser] = await Promise.all([
    listProjectMembers(projectId).catch(() => []),
    getCurrentUser(),
  ]);

  const currentMembership = currentUser
    ? members.find((member) => member.user_id === currentUser.id)
    : undefined;
  const canManageMembers =
    currentUser?.role === 'admin' || currentMembership?.role === 'admin';

  return (
    <MembersSettings
      projectId={projectId}
      members={members}
      currentUserId={currentUser?.id}
      canManage={canManageMembers}
    />
  );
}
