import type { AgentModelRow } from '@rustrak/client';
import { getFormatter, getTranslations } from 'next-intl/server';
import { cn } from '@/shared/lib/utils';

interface AgentModelsTableProps {
  rows: AgentModelRow[];
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Per-model volume, failures, latency and token split.
 *
 * Cached input and reasoning output are rendered as a share of their parent
 * rather than as peers: per OTel convention they are subsets of input and
 * output, and four columns of raw counts invite a reader to add all of them.
 */
export async function AgentModelsTable({ rows }: AgentModelsTableProps) {
  const t = await getTranslations('agents.modelsTable');
  const format = await getFormatter();

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">{t('model')}</th>
            <th className="pb-2 px-3 text-right font-medium">
              {t('requests')}
            </th>
            <th className="pb-2 px-3 text-right font-medium">{t('errors')}</th>
            <th className="pb-2 px-3 text-right font-medium">{t('avg')}</th>
            <th className="pb-2 px-3 text-right font-medium">{t('p95')}</th>
            <th className="pb-2 px-3 text-right font-medium">{t('input')}</th>
            <th className="pb-2 px-3 text-right font-medium">{t('cached')}</th>
            <th className="pb-2 px-3 text-right font-medium">{t('output')}</th>
            <th className="pb-2 pl-3 text-right font-medium">
              {t('reasoning')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const cachedShare =
              row.input_tokens > 0
                ? row.cached_input_tokens / row.input_tokens
                : 0;
            const reasoningShare =
              row.output_tokens > 0
                ? row.reasoning_output_tokens / row.output_tokens
                : 0;

            return (
              <tr key={row.model}>
                <td className="py-2 pr-3 font-mono">{row.model}</td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {format.number(row.requests)}
                </td>
                <td
                  className={cn(
                    'py-2 px-3 text-right tabular-nums',
                    row.errors > 0 && 'font-semibold text-destructive',
                  )}
                >
                  {format.number(row.errors)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                  {formatMs(row.avg_ms)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {formatMs(row.p95_ms)}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {format.number(row.input_tokens, 'compact')}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {format.number(row.cached_input_tokens, 'compact')}
                  {cachedShare > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {format.number(cachedShare, 'percent')}
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {format.number(row.output_tokens, 'compact')}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums">
                  {format.number(row.reasoning_output_tokens, 'compact')}
                  {reasoningShare > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {format.number(reasoningShare, 'percent')}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
