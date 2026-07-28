import { AlertCircle } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getInvitation } from '@/features/user/api/queries';
import { RustrakLogoIcon } from '@/shared/ui/rustrak-logo';
import { Button } from '@/shared/ui/shadcn/button';
import { AcceptInvitationForm } from './_components/accept-invitation-form';

export const metadata: Metadata = {
  title: 'Accept Invitation | Rustrak',
  description: 'Accept your invitation to join Rustrak',
};

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const result = await getInvitation(token);

  const isInvalid =
    !result.success ||
    result.data.status !== 'pending' ||
    new Date(result.data.expires_at).getTime() < Date.now();

  return (
    <div className="min-h-screen bg-card flex items-center justify-center p-8 lg:p-12">
      <div className="w-full max-w-[420px] space-y-10">
        <div className="flex items-center gap-2">
          <RustrakLogoIcon className="size-8" />
          <span className="text-lg font-extrabold tracking-tight uppercase">
            Rustrak
          </span>
        </div>

        {isInvalid ? (
          <div className="space-y-6">
            <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Invitation unavailable
              </h1>
              <p className="text-muted-foreground">
                This invitation link is invalid, has expired, or has already
                been used. Ask an administrator to send you a new one.
              </p>
            </div>
            <Button
              nativeButton={false}
              render={<Link href="/auth/login" />}
              variant="outline"
              className="w-full"
            >
              Go to login
            </Button>
          </div>
        ) : (
          <AcceptInvitationForm token={token} email={result.data.email} />
        )}
      </div>
    </div>
  );
}
