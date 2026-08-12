import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { getProject } from '@/features/project/api/queries';
import { getTransaction } from '@/features/transaction/api/queries';
import type { Span, TraceContext } from '@/features/transaction/model/span';
import { MeasurementsCard } from '@/features/transaction/ui/components/measurements-card';
import { SpanWaterfall } from '@/features/transaction/ui/components/span-waterfall';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { Badge } from '@/shared/ui/components/shadcn/badge';

interface TransactionDetailPageProps {
  params: Promise<{ id: string; txnId: string }>;
}

export async function generateMetadata({
  params,
}: TransactionDetailPageProps): Promise<Metadata> {
  const t = await getTranslations('projectPages');
  const { id, txnId } = await params;
  const txn = await getTransaction(parseInt(id, 10), txnId);
  return {
    title: txn.success
      ? t('transaction.meta.title', { name: txn.data.transaction_name })
      : t('transaction.meta.fallbackTitle'),
  };
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function epochSeconds(raw: unknown, fallbackIso: string): number {
  if (typeof raw === 'number') return raw;
  return Date.parse(fallbackIso) / 1000;
}

/** Renders the primitive entries of an object as a key/value list. */
function KeyValuePanel({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown>;
}) {
  const entries = Object.entries(data).filter(
    ([, v]) => v != null && typeof v !== 'object',
  );
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      <dl className="divide-y">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-start justify-between gap-4 px-4 py-2 text-sm"
          >
            <dt className="font-mono text-muted-foreground">{key}</dt>
            <dd className="font-mono text-right break-all">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function TransactionDetailPage({
  params,
}: TransactionDetailPageProps) {
  const t = await getTranslations('projectPages');
  const format = await getFormatter();
  const { id, txnId } = await params;
  const projectId = parseInt(id, 10);

  const loaded = await loadAll([
    getProject(projectId),
    getTransaction(projectId, txnId),
  ]);

  if (!loaded.success) {
    return (
      <LoadFailure error={loaded.error} title={t('transaction.loadFailed')} />
    );
  }

  const [, txn] = loaded.data;

  const data = txn.data ?? {};
  const trace = asObject(data.contexts)?.trace as
    | Record<string, unknown>
    | undefined;
  const spans = Array.isArray(data.spans) ? data.spans : [];
  const measurements = asObject(data.measurements);
  const tags = asObject(data.tags);
  const request = asObject(data.request);
  const user = asObject(data.user);

  const transactionStart = epochSeconds(
    data.start_timestamp,
    txn.start_timestamp ?? txn.timestamp,
  );
  const transactionEnd = epochSeconds(data.timestamp, txn.timestamp);

  const op = typeof trace?.op === 'string' ? trace.op : undefined;
  const status = typeof trace?.status === 'string' ? trace.status : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="shrink-0 w-full px-4 md:px-8 py-4 md:py-6 border-b">
        <Link
          href={`/projects/${projectId}/performance`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="size-4" />
          {t('performance.backLink')}
        </Link>
        <h1 className="font-mono text-lg font-semibold break-all">
          {txn.transaction_name || t('transaction.unnamed')}
        </h1>
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
          {txn.environment && (
            <Badge variant="outline">{txn.environment}</Badge>
          )}
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
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto w-full px-4 md:px-8 py-4 md:py-6 space-y-6">
        {measurements && <MeasurementsCard measurements={measurements} />}

        <section className="rounded-lg border">
          <div className="border-b px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('transaction.spans')}
            </h2>
            <span className="text-xs text-muted-foreground">
              {t('spanCount', { count: spans.length })}
            </span>
          </div>
          <div className="p-3">
            {spans.length === 0 && !trace ? (
              <p className="text-sm text-muted-foreground px-1 py-4 text-center">
                {t('transaction.noSpans')}
              </p>
            ) : (
              <SpanWaterfall
                spans={spans as Span[]}
                trace={trace as TraceContext | undefined}
                transactionStart={transactionStart}
                transactionEnd={transactionEnd}
              />
            )}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {tags && <KeyValuePanel title={t('transaction.tags')} data={tags} />}
          {request && (
            <KeyValuePanel title={t('transaction.request')} data={request} />
          )}
          {user && <KeyValuePanel title={t('transaction.user')} data={user} />}
        </div>
      </div>
    </div>
  );
}
