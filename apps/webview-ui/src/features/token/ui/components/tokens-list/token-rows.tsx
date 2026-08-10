'use client';

import type { AuthToken } from '@rustrak/client';
import { format, formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { DataTable } from '@/shared/ui/components/data-table/data-table';
import {
  createAppColumnHelper,
  useAppTable,
} from '@/shared/ui/components/data-table/use-app-table';
import { TokenActions } from './token-actions';

/** When a token was last used, or that it never has been. */
function lastUsed(token: AuthToken, t: (key: string) => string): string {
  return token.last_used_at
    ? formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true })
    : t('never');
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
 * Kept rather than folded into the table's responsive column hiding. A table
 * narrowed to two columns is a worse phone layout than a card, and the table
 * is what would have to give way here, not the other way round.
 */
export function TokenCards({
  tokens,
  isBusy,
  onCopy,
  onDelete,
}: TokenListProps) {
  const t = useTranslations('tokens');
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
              {t('createdOn', { date: created(token) })}
              {' · '}
              {token.last_used_at
                ? t('usedOn', { time: lastUsed(token, t) })
                : t('neverUsed')}
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

const helper = createAppColumnHelper<AuthToken>();

/** The desktop layout: the same tokens as a table. */
export function TokenTable({
  tokens,
  isBusy,
  onCopy,
  onDelete,
}: TokenListProps) {
  const t = useTranslations('tokens');
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('token_prefix', {
          header: t('columns.token'),
          size: 160,
          minSize: 120,
          cell: ({ getValue }) => (
            <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
              {getValue()}
            </code>
          ),
        }),
        helper.accessor('description', {
          header: t('columns.description'),
          minSize: 200,
          meta: { grow: true },
          cell: ({ getValue }) =>
            getValue() || <span className="text-muted-foreground">-</span>,
        }),
        helper.accessor('created_at', {
          id: 'created',
          header: t('columns.created'),
          size: 150,
          minSize: 120,
          cell: ({ row }) => (
            <span className="text-sm whitespace-nowrap">
              {created(row.original)}
            </span>
          ),
        }),
        helper.accessor('last_used_at', {
          id: 'last_used',
          header: t('columns.lastUsed'),
          size: 160,
          minSize: 120,
          cell: ({ row }) => (
            <span
              className={
                row.original.last_used_at
                  ? 'text-sm whitespace-nowrap'
                  : 'text-sm whitespace-nowrap text-muted-foreground'
              }
            >
              {lastUsed(row.original, t)}
            </span>
          ),
        }),
        helper.display({
          id: 'actions',
          // Two 36px icon buttons, a 4px gap and the cell's own 8px of padding
          // either side. Sized to the controls rather than guessed, because a
          // fixed column that is too narrow clips rather than wraps.
          size: 96,
          minSize: 96,
          maxSize: 96,
          header: () => <span className="sr-only">{t('actionsLabel')}</span>,
          cell: ({ row }) => (
            <TokenActions
              token={row.original}
              busy={isBusy(row.original)}
              onCopy={onCopy}
              onDelete={onDelete}
            />
          ),
        }),
      ]),
    // Rebuilt when the handlers change identity, which is the honest
    // dependency. Issues reaches for a ref to avoid exactly this, because its
    // column model is large enough for a resize drag to feel it; a settings
    // table with a handful of rows is not.
    [isBusy, onCopy, onDelete, t],
  );

  const table = useAppTable({
    data: tokens,
    columns,
    getRowId: (token) => String(token.id),
    rowCount: tokens.length,
  });

  return <DataTable table={table} className="hidden md:block" />;
}
