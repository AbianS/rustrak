import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getProject } from '@/features/project/api/queries';
import { getTransaction } from '@/features/transaction/api/queries';
import { readTransactionPayload } from '@/features/transaction/lib/transaction-payload';
import { MeasurementsCard } from '@/features/transaction/ui/components/measurements-card';
import { SpanWaterfall } from '@/features/transaction/ui/components/span-waterfall';
import { loadAll } from '@/shared/lib/results';
import { LoadFailure } from '@/shared/ui/components/load-failure';
import { TransactionBadges } from './_components/transaction-badges';

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

  const {
    trace,
    spans,
    measurements,
    tags,
    request,
    user,
    transactionStart,
    transactionEnd,
    op,
    status,
  } = readTransactionPayload(txn);

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
        <TransactionBadges txn={txn} op={op} status={status} />
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
                spans={spans}
                trace={trace}
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
