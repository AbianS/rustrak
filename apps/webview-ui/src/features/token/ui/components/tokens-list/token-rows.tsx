'use client';

import type { AuthToken } from '@rustrak/client';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/components/shadcn/table';
import { TokenActions } from './token-actions';

/** When a token was last used, or that it never has been. */
function lastUsed(token: AuthToken): string {
  return token.last_used_at
    ? formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true })
    : 'Never';
}

const created = (token: AuthToken) =>
  format(new Date(token.created_at), 'MMM d, yyyy');

export interface TokenListProps {
  tokens: AuthToken[];
  isBusy: (token: AuthToken) => boolean;
  onCopy: (token: AuthToken) => void;
  onDelete: (token: AuthToken) => void;
}

/**
 * The phone layout: one card per token, facts stacked rather than columned.
 *
 * Created and last-used share a line here because at this width four columns
 * would each be too narrow to read, and neither number is worth its own row.
 */
export function TokenCards({
  tokens,
  isBusy,
  onCopy,
  onDelete,
}: TokenListProps) {
  return (
    <div className="md:hidden space-y-3">
      {tokens.map((token) => (
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
              Created {created(token)}
              {' · '}
              {token.last_used_at ? `Used ${lastUsed(token)}` : 'Never used'}
            </p>
          </div>
          <TokenActions
            token={token}
            busy={isBusy(token)}
            onCopy={onCopy}
            onDelete={onDelete}
          />
        </div>
      ))}
    </div>
  );
}

/** The desktop layout: the same tokens as a table. */
export function TokenTable({
  tokens,
  isBusy,
  onCopy,
  onDelete,
}: TokenListProps) {
  return (
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
        {tokens.map((token) => (
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
              <span className="text-sm">{created(token)}</span>
            </TableCell>
            <TableCell>
              <span
                className={
                  token.last_used_at
                    ? 'text-sm'
                    : 'text-sm text-muted-foreground'
                }
              >
                {lastUsed(token)}
              </span>
            </TableCell>
            <TableCell>
              <TokenActions
                token={token}
                busy={isBusy(token)}
                onCopy={onCopy}
                onDelete={onDelete}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
