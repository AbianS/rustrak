import type { AgentToolRow } from '@rustrak/client';
import { getFormatter, getTranslations } from 'next-intl/server';
import { cn } from '@/shared/lib/utils';

interface AgentToolsTableProps {
  rows: AgentToolRow[];
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Per-tool call volume, failures and latency.
 *
 * The failure *rate* is shown next to the count, because "3 errors" reads
 * very differently against 4 calls than against 4000.
 */
export async function AgentToolsTable({ rows }: AgentToolsTableProps) {
  const t = await getTranslations('agents.toolsTable');
  const format = await getFormatter();

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">{t('tool')}</th>
            <th className="pb-2 px-3 text-right font-medium">{t('calls')}</th>
            <th className="pb-2 px-3 text-right font-medium">{t('errors')}</th>
            <th className="pb-2 px-3 text-right font-medium">{t('avg')}</th>
            <th className="pb-2 pl-3 text-right font-medium">{t('p95')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const failureRate = row.calls > 0 ? row.errors / row.calls : 0;

            return (
              <tr key={row.tool}>
                <td className="py-2 pr-3 font-mono">{row.tool}</td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {format.number(row.calls)}
                </td>
                <td
                  className={cn(
                    'py-2 px-3 text-right tabular-nums',
                    row.errors > 0 && 'font-semibold text-destructive',
                  )}
                >
                  {format.number(row.errors)}
                  {row.errors > 0 && (
                    <span className="ml-1 text-xs font-normal">
                      {format.number(failureRate, 'percent')}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                  {formatMs(row.avg_ms)}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums">
                  {formatMs(row.p95_ms)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
