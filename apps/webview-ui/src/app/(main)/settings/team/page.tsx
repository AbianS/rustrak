import { ShieldX } from 'lucide-react';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/actions/auth';
import { listInvitations } from '@/actions/invitations';
import { listTeam } from '@/actions/team';
import { Card, CardContent } from '@/components/ui/card';
import { InviteForm } from './components/invite-form';
import { PendingInvitations } from './components/pending-invitations';
import { TeamMembersList } from './components/team-members-list';

export const metadata: Metadata = {
  title: 'Team | Rustrak',
  description: 'Manage your team members and invitations',
};

export default async function TeamPage() {
  const user = await getCurrentUser();

  // Guard: only instance admins may manage the team.
  if (user?.role !== 'admin') {
    return (
      <>
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
            Team
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your team members and invitations
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldX className="size-12 text-muted-foreground/50 mb-4" />
            <p className="font-semibold">Not authorized</p>
            <p className="text-muted-foreground mt-1 text-sm max-w-sm">
              Only instance administrators can manage the team. Contact an admin
              if you need access.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  const [members, invitations] = await Promise.all([
    listTeam(),
    listInvitations(),
  ]);

  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === 'pending',
  );

  return (
    <>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          Team
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your team members and invitations
        </p>
      </div>

      <div className="space-y-6">
        <InviteForm />
        <TeamMembersList members={members} currentUserId={user.id} />
        <PendingInvitations invitations={pendingInvitations} />
      </div>
    </>
  );
}
