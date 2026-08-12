'use client';

import type { AuthToken } from '@rustrak/client';
import { Copy, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/shared/ui/components/shadcn/button';

/**
 * Copy and delete for one token, shared by the phone card and the desktop row.
 *
 * The two layouts had this pair written out twice, down to the triple
 * `disabled` condition and the labels. A token is identified by its
 * description where it has one and by its prefix otherwise, and that fallback
 * is the whole reason these buttons need labels: the icons alone announce
 * "copy" and "delete" without ever saying what.
 */
export function TokenActions({
  token,
  busy,
  onCopy,
  onDelete,
}: {
  token: AuthToken;
  busy: boolean;
  onCopy: (token: AuthToken) => void;
  onDelete: (token: AuthToken) => void;
}) {
  const t = useTranslations('tokens');
  const label = token.description || token.token_prefix;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onCopy(token)}
        disabled={busy}
        aria-label={t('copyTokenLabel', { label })}
      >
        <Copy className="size-4" />
      </Button>
      <Button
        variant="destructive"
        size="icon"
        onClick={() => onDelete(token)}
        disabled={busy}
        aria-label={t('deleteTokenLabel', { label })}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
