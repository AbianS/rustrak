'use client';

import type { AuthToken } from '@rustrak/client';
import { Key, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  createToken,
  deleteToken,
  getToken,
} from '@/features/token/api/mutations';
import { copyToClipboard } from '@/shared/lib/clipboard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/components/shadcn/alert-dialog';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/components/shadcn/card';
import { CreateTokenDialog } from './create-token-dialog';
import { TokenCards, TokenTable } from './token-rows';

interface TokensListProps {
  initialTokens: AuthToken[];
}

export function TokensList({ initialTokens }: TokensListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  // Which single token a request is in flight for, so only its own buttons go
  // quiet rather than the whole table.
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AuthToken | null>(null);

  const closeCreate = () => {
    setIsCreateOpen(false);
    setNewToken(null);
    router.refresh();
  };

  const create = (description: string) => {
    startTransition(async () => {
      const result = await createToken({
        description: description || undefined,
      });

      if (!result.success) {
        toast.error('Failed to create token', {
          description: result.error.message,
        });
        return;
      }

      setNewToken(result.data.token);
      toast.success('Token created', {
        description: 'Make sure to copy your token now.',
      });
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setBusyId(id);
    setPendingDelete(null);

    startTransition(async () => {
      const result = await deleteToken(id);

      if (result.success) {
        toast.success('Token deleted');
        router.refresh();
      } else {
        toast.error('Failed to delete token', {
          description: result.error.message,
        });
      }

      setBusyId(null);
    });
  };

  const copy = (token: AuthToken) => {
    setBusyId(token.id);
    startTransition(async () => {
      const result = await getToken(token.id);

      if (!result.success) {
        toast.error('Failed to get token', {
          description: result.error.message,
        });
        setBusyId(null);
        return;
      }

      if (await copyToClipboard(result.data.token)) {
        toast.success('Token copied to clipboard');
      } else {
        // No clipboard (an insecure origin, usually). Showing the value is the
        // fallback: it is the one thing the user came here for.
        toast.info('Copy the token', { description: result.data.token });
      }
      setBusyId(null);
    });
  };

  const copyNewToken = async () => {
    if (!newToken) return false;
    if (await copyToClipboard(newToken)) return true;

    toast.info('Clipboard unavailable', {
      description:
        'Select the token and copy it manually, or access Rustrak over HTTPS.',
    });
    return false;
  };

  const rowProps = {
    tokens: initialTokens,
    isBusy: (token: AuthToken) => isPending || busyId === token.id,
    onCopy: copy,
    onDelete: setPendingDelete,
  };

  return (
    <div className="space-y-6">
      <CreateTokenDialog
        open={isCreateOpen}
        onOpenChange={(open) => (open ? setIsCreateOpen(true) : closeCreate())}
        newToken={newToken}
        isPending={isPending}
        onCreate={create}
        onDone={closeCreate}
        onCopyToken={copyNewToken}
      />

      {initialTokens.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="size-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">No API tokens yet</p>
            <Button variant="outline" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create your first token
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Tokens</CardTitle>
            <CardDescription>
              Tokens are used to authenticate API requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TokenCards {...rowProps} />
            <TokenTable {...rowProps} />
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Token?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this token. Any services using it
              will lose access immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
