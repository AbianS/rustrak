import { getFormatter, getTranslations } from 'next-intl/server';
import type { TraceSummary } from '@/features/agent-trace/model/trace-summary';
import { Badge } from '@/shared/ui/components/shadcn/badge';

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * What the trace cost, in one line.
 *
 * Every count except tokens is hidden at zero: "0 tool calls" on a trace that
 * never used a tool is a fact about nothing. Tokens always show, because zero
 * tokens on an agent trace is itself worth seeing.
 */
export async function TraceSummaryBadges({
  summary,
}: {
  summary: TraceSummary;
}) {
  const t = await getTranslations('projectPages');
  const format = await getFormatter();

  const { duration, totalTokens, llmCallCount, toolCallCount, errorCount } =
    summary;

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
      <span className="font-mono font-semibold">
        {formatDuration(duration)}
      </span>

      <Badge variant="secondary">
        {t('trace.tokens', { count: format.number(totalTokens) })}
      </Badge>

      {llmCallCount > 0 && (
        <Badge variant="outline">
          {t('trace.llmCalls', { count: llmCallCount })}
        </Badge>
      )}
      {toolCallCount > 0 && (
        <Badge variant="outline">
          {t('trace.toolCalls', { count: toolCallCount })}
        </Badge>
      )}
      {errorCount > 0 && (
        <Badge variant="destructive">
          {t('trace.errors', { count: errorCount })}
        </Badge>
      )}

      {summary.models.map((model) => (
        <Badge key={model} variant="outline" className="font-mono">
          {model}
        </Badge>
      ))}

      {summary.startedAt != null && (
        <span className="text-xs text-muted-foreground">
          {format.dateTime(new Date(summary.startedAt), 'precise')}
        </span>
      )}
    </div>
  );
}
