'use client';

import type { AuthToken } from '@rustrak/client';
import { format, formatDistanceToNow } from 'date-fns';
import { Check, Copy, Key, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createToken, deleteToken, getToken } from '@/actions/tokens';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { copyToClipboard } from '@/lib/clipboard';

const TOKEN_DESCRIPTION_MAX_LENGTH = 200;

interface TokensListProps {
  initialTokens: AuthToken[];
}

export function TokensList({ initialTokens }: TokensListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tokenToDeleteId, setTokenToDeleteId] = useState<number | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);

  const trimmedDescription = description.trim();
  const isDescriptionValid =
    trimmedDescription.length <= TOKEN_DESCRIPTION_MAX_LENGTH;

  const handleCreate = () => {
    if (!isDescriptionValid) return;

    startTransition(async () => {
      const result = await createToken({
        description: trimmedDescription || undefined,
      });

      if (!result.success) {
        toast.error('Failed to create token', {
          description: result.error.message,
        });
        return;
      }

      setNewToken(result.data.token);
      setDescription('');
      toast.success('Token created', {
        description: 'Make sure to copy your token now.',
      });
    });
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setNewToken(null);
    router.refresh();
  };

  const handleConfirmDelete = () => {
    if (tokenToDeleteId === null) return;
    setDeletingId(tokenToDeleteId);
    setDeleteDialogOpen(false);
    startTransition(async () => {
      const result = await deleteToken(tokenToDeleteId);

      if (result.success) {
        toast.success('Token deleted');
        router.refresh();
      } else {
        toast.error('Failed to delete token', {
          description: result.error.message,
        });
      }

      setDeletingId(null);
      setTokenToDeleteId(null);
    });
  };

  const handleCopy = (token: AuthToken) => {
    setCopyingId(token.id);
    startTransition(async () => {
      const result = await getToken(token.id);

      if (!result.success) {
        toast.error('Failed to get token', {
          description: result.error.message,
        });
        setCopyingId(null);
        return;
      }

      const copied = await copyToClipboard(result.data.token);
      if (copied) {
        toast.success('Token copied to clipboard');
      } else {
        toast.info('Copy the token', { description: result.data.token });
      }
      setCopyingId(null);
    });
  };

  const copyToken = async () => {
    if (!newToken) return;

    if (!(await copyToClipboard(newToken))) {
      toast.info('Clipboard unavailable', {
        description:
          'Select the token and copy it manually, or access Rustrak over HTTPS.',
      });
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Create Token Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseCreate();
          else setIsCreateOpen(true);
        }}
      >
        <DialogTrigger
          render={<Button className="font-bold uppercase tracking-wider" />}
        >
          <Plus className="mr-2 size-4" />
          New Token
        </DialogTrigger>
        <DialogContent>
          {!newToken ? (
            <>
              <DialogHeader>
                <DialogTitle>Create API Token</DialogTitle>
                <DialogDescription>
                  Create a new token for programmatic API access.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    placeholder="e.g., CI/CD Pipeline"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    maxLength={TOKEN_DESCRIPTION_MAX_LENGTH + 10}
                    aria-invalid={!isDescriptionValid}
                  />
                  <p className="text-xs text-muted-foreground">
                    {trimmedDescription.length}/{TOKEN_DESCRIPTION_MAX_LENGTH}{' '}
                    characters
                  </p>
                  {!isDescriptionValid && (
                    <p className="text-sm text-destructive">
                      Description must be at most {TOKEN_DESCRIPTION_MAX_LENGTH}{' '}
                      characters
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isPending || !isDescriptionValid}
                >
                  {isPending ? 'Creating...' : 'Create Token'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Token Created</DialogTitle>
                <DialogDescription>
                  Copy your token now. You can also retrieve it later from the
                  list.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex items-center gap-2 p-3 bg-card border rounded-lg">
                  <code className="flex-1 text-sm font-mono break-all">
                    {newToken}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyToken}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="size-4 text-primary" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  You can copy this token again anytime from the token list.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseCreate}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Tokens Table */}
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
            {/* Mobile: card list */}
            <div className="md:hidden space-y-3">
              {initialTokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded block w-fit">
                      {token.token_prefix}
                    </code>
                    {token.description && (
                      <p className="text-sm truncate">{token.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Created{' '}
                      {format(new Date(token.created_at), 'MMM d, yyyy')}
                      {' · '}
                      {token.last_used_at
                        ? `Used ${formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true })}`
                        : 'Never used'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(token)}
                      disabled={
                        isPending ||
                        deletingId === token.id ||
                        copyingId === token.id
                      }
                      aria-label={`Copy token ${token.description || token.token_prefix}`}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        setTokenToDeleteId(token.id);
                        setDeleteDialogOpen(true);
                      }}
                      disabled={
                        isPending ||
                        deletingId === token.id ||
                        copyingId === token.id
                      }
                      aria-label={`Delete token ${token.description || token.token_prefix}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialTokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell>
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {token.token_prefix}
                      </code>
                    </TableCell>
                    <TableCell>
                      {token.description || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(token.created_at), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {token.last_used_at ? (
                        <span className="text-sm">
                          {formatDistanceToNow(new Date(token.last_used_at), {
                            addSuffix: true,
                          })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Never
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(token)}
                          disabled={
                            isPending ||
                            deletingId === token.id ||
                            copyingId === token.id
                          }
                          aria-label={`Copy token ${token.description || token.token_prefix}`}
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => {
                            setTokenToDeleteId(token.id);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={
                            isPending ||
                            deletingId === token.id ||
                            copyingId === token.id
                          }
                          aria-label={`Delete token ${token.description || token.token_prefix}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
              onClick={handleConfirmDelete}
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
