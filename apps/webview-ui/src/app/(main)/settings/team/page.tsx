import { ShieldX } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/actions/auth';
import { listInvitations } from '@/actions/invitations';
import { listTeam } from '@/actions/team';
import { LoadFailure } from '@/components/load-failure';
import { ServiceUnavailable } from '@/components/service-unavailable';
import { Card, CardContent } from '@/components/ui/card';
import { loadAll } from '@/lib/results';
import { InviteForm } from './components/invite-form';
import { PendingInvitations } from './components/pending-invitations';
import { TeamMembersList } from './components/team-members-list';

export const metadata: Metadata = {
  title: 'Team | Rustrak',
  description: 'Manage your team members and invitations',
};

export default async function TeamPage() {
  const session = await getCurrentUser();

  if (session.state === 'anonymous') {
    redirect('/auth/login');
  }

  // Checked before the admin guard: an outage is not a permission verdict, and
  // the old `user?.role !== 'admin'` reported one as the other.
  if (session.state === 'unavailable') {
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
        <ServiceUnavailable error={session.error} />
      </>
    );
  }

  // Guard: only instance admins may manage the team.
  if (session.user.role !== 'admin') {
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

  const loaded = await loadAll([listTeam(), listInvitations()]);

  if (!loaded.success) {
    return (
      <LoadFailure
        error={loaded.error}
        title="Could not load the team"
        notFoundOnMissing={false}
      />
    );
  }

  const [members, invitations] = loaded.data;

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
        <TeamMembersList members={members} currentUserId={session.user.id} />
        <PendingInvitations invitations={pendingInvitations} />
      </div>
    </>
  );
}
