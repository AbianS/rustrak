import type { Result, RustrakError, SpanDetail } from '@rustrak/client';
import { getTranslations } from 'next-intl/server';
import { AiSpanDetail } from '@/features/agent-trace/ui/components/ai-span-detail';
import { LoadFailure } from '@/shared/ui/components/load-failure';

interface SpanDetailPaneProps {
  /** The loaded span, or `null` when no span is selected. */
  selected: Result<SpanDetail, RustrakError> | null;
  /** The URL named a span this trace does not contain. */
  requestedMissing: boolean;
}

/**
 * The right-hand pane, and the four answers it has to tell apart.
 *
 * The distinction that matters is between "gone" and "broken": reporting a
 * timeout or a 500 as "that span is no longer available" would send the reader
 * looking for a deleted span that is still there.
 */
export async function SpanDetailPane({
  selected,
  requestedMissing,
}: SpanDetailPaneProps) {
  const t = await getTranslations('projectPages');

  const notFound =
    selected?.success === false && selected.error.kind === 'not_found';

  // A stale link, not an outage -- say so in place rather than replacing the
  // whole trace view with a failure surface.
  if (requestedMissing || notFound) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('trace.spanUnavailable')}
      </p>
    );
  }

  if (selected == null) {
    return (
      <p className="text-sm text-muted-foreground">{t('trace.selectSpan')}</p>
    );
  }

  if (!selected.success) {
    return <LoadFailure error={selected.error} title={t('trace.loadFailed')} />;
  }

  return <AiSpanDetail span={selected.data} />;
}
