import type { AgentSummary } from '@rustrak/client';
import { getFormatter, getTranslations } from 'next-intl/server';
import { cn } from '@/shared/lib/utils';

interface AgentSummaryTilesProps {
  summary: AgentSummary;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * The numbers the charts show the shape of but never state.
 *
 * Errors is the only tile that changes colour, and only when non-zero: a row
 * of tiles where everything is emphasised emphasises nothing.
 */
export async function AgentSummaryTiles({ summary }: AgentSummaryTilesProps) {
  const t = await getTranslations('agents.summary');
  const format = await getFormatter();

  const tiles = [
    {
      key: 'runs',
      label: t('agentRuns'),
      value: format.number(summary.agent_runs),
    },
    {
      key: 'llm',
      label: t('llmCalls'),
      value: format.number(summary.llm_calls),
    },
    {
      key: 'tools',
      label: t('toolCalls'),
      value: format.number(summary.tool_calls),
    },
    {
      key: 'tokens',
      label: t('totalTokens'),
      value: format.number(summary.total_tokens, 'compact'),
    },
    {
      key: 'avg',
      label: t('avgDuration'),
      value: formatMs(summary.avg_duration_ms),
    },
    {
      key: 'p95',
      label: t('p95Duration'),
      value: formatMs(summary.p95_duration_ms),
    },
    {
      key: 'errors',
      label: t('errors'),
      value: format.number(summary.error_count),
      alarming: summary.error_count > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {tiles.map((tile) => (
        <div key={tile.key} className="rounded-lg border px-3 py-2.5">
          <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {tile.label}
          </p>
          <p
            className={cn(
              'mt-0.5 font-mono text-xl font-semibold tabular-nums',
              tile.alarming && 'text-destructive',
            )}
          >
            {tile.value}
          </p>
        </div>
      ))}
    </div>
  );
}
