import type { TransactionDetail } from '@rustrak/client';
import { getFormatter } from 'next-intl/server';
import { Badge } from '@/shared/ui/components/shadcn/badge';

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface TransactionBadgesProps {
  txn: TransactionDetail;
  /** From the trace context, which is where the SDK puts them. */
  op: string | undefined;
  status: string | undefined;
}

/**
 * What this transaction was, in one line.
 *
 * Everything except the duration and the timestamp is hidden when absent: an
 * SDK that reports no environment should leave a gap, not an empty badge.
 */
export async function TransactionBadges({
  txn,
  op,
  status,
}: TransactionBadgesProps) {
  const format = await getFormatter();

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
      <span className="font-mono font-semibold">
        {formatDuration(txn.duration_ms)}
      </span>

      {op && <Badge variant="secondary">{op}</Badge>}
      {status && (
        <Badge variant={status === 'ok' ? 'outline' : 'destructive'}>
          {status}
        </Badge>
      )}
      {txn.environment && <Badge variant="outline">{txn.environment}</Badge>}
      {txn.platform && <Badge variant="outline">{txn.platform}</Badge>}

      {txn.release && (
        <span className="font-mono text-xs text-muted-foreground">
          {txn.release}
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        {format.dateTime(new Date(txn.timestamp), 'precise')}
      </span>
    </div>
  );
}
