'use client';

import type { AuthToken } from '@rustrak/client';
import { format, formatDistanceToNow } from 'date-fns';
import { Check, Copy, Key, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createToken, deleteToken } from '@/actions/tokens';
import { Button } from '@/components/ui/button';

const TOKEN_DESCRIPTION_MAX_LENGTH = 200;

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

  const trimmedDescription = description.trim();
  const isDescriptionValid =
    trimmedDescription.length <= TOKEN_DESCRIPTION_MAX_LENGTH;

  const handleCreate = () => {
    if (!isDescriptionValid) return;

    startTransition(async () => {
      try {
        const result = await createToken({
          description: trimmedDescription || undefined,
        });
        setNewToken(result.token);
        setDescription('');
        toast.success('Token created', {
          description: 'Make sure to copy your token now.',
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create token';
        toast.error('Failed to create token', { description: message });
      }
    });
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setNewToken(null);
    router.refresh();
  };

  const handleDelete = (id: number) => {
    startTransition(async () => {
      try {
        await deleteToken(id);
        toast.success('Token deleted');
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete token';
        toast.error('Failed to delete token', { description: message });
      }
    });
  };

  const copyToken = async () => {
    if (newToken) {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
        <DialogTrigger asChild>
          <Button className="font-bold uppercase tracking-wider">
            <Plus className="mr-2 size-4" />
            New Token
          </Button>
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
                  Copy your token now. You won&apos;t be able to see it again!
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
                <p className="text-xs text-destructive mt-2">
                  Make sure to copy your token now. It will not be shown again.
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="w-[50px]" />
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(token.id)}
                        disabled={isPending}
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete token ${token.description || token.token_prefix}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
