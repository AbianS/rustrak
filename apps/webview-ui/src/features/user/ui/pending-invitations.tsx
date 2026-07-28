'use client';

import type { Invitation } from '@rustrak/client';
import { format } from 'date-fns';
import { Copy, Mail, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { revokeInvitation } from '@/features/user/api/mutations';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { Badge } from '@/shared/ui/shadcn/badge';
import { Button } from '@/shared/ui/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/shadcn/card';

interface PendingInvitationsProps {
  invitations: Invitation[];
}

export function PendingInvitations({ invitations }: PendingInvitationsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleCopy = async (invitation: Invitation) => {
    const link = `${window.location.origin}/invite/${invitation.token}`;
    const copied = await copyToClipboard(link);
    if (copied) {
      toast.success('Invite link copied to clipboard');
    } else {
      toast.info('Copy the invite link', { description: link });
    }
  };

  const handleRevoke = (invitation: Invitation) => {
    startTransition(async () => {
      const result = await revokeInvitation(invitation.token);
      if (result.success) {
        toast.success('Invitation revoked');
        router.refresh();
      } else {
        // No form here, so there is no input to attach a `fields` entry to;
        // the message is what the row can show.
        toast.error('Failed to revoke invitation', {
          description: result.error.message,
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
        <CardDescription>
          Invitations that have not been accepted yet
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Mail className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">
              No pending invitations
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {invitations.map((invitation) => (
              <li
                key={invitation.token}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {invitation.email}
                    </p>
                    <Badge
                      variant={
                        invitation.role === 'admin' ? 'default' : 'secondary'
                      }
                    >
                      {invitation.role === 'admin' ? 'Admin' : 'Member'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Expires{' '}
                    {format(new Date(invitation.expires_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(invitation)}
                    aria-label={`Copy invite link for ${invitation.email}`}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleRevoke(invitation)}
                    disabled={isPending}
                    aria-label={`Revoke invitation for ${invitation.email}`}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
