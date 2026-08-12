'use client';

import type { EventDetail } from '@rustrak/client';
import { Check, Copy } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/clipboard';
import { Button } from '@/shared/ui/components/shadcn/button';

interface EventDetailsProps {
  event: EventDetail;
}

interface DetailRowProps {
  label: string;
  value: string | number | boolean | null | undefined;
  mono?: boolean;
  copyable?: boolean;
}

function DetailRow({
  label,
  value,
  mono = false,
  copyable = false,
}: DetailRowProps) {
  const t = useTranslations('events');
  const common = useTranslations('common');
  const [copied, setCopied] = useState(false);

  if (value === null || value === undefined || value === '') return null;

  const displayValue =
    typeof value === 'boolean'
      ? value
        ? t('details.yes')
        : t('details.no')
      : String(value);

  const handleCopy = async () => {
    if (!(await copyToClipboard(displayValue))) {
      toast.info(common('clipboardUnavailable'), {
        description: t('clipboardValueHint'),
      });
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start gap-4 py-2 border-b border-dotted last:border-b-0">
      <span className="w-1/4 text-sm text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span
          className={`text-sm break-all ${mono ? 'font-mono text-xs' : ''}`}
        >
          {displayValue}
        </span>
        {copyable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 w-6 p-0 shrink-0"
          >
            {copied ? (
              <Check className="size-3 text-primary" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h4>
      <div className="bg-card rounded-lg border p-4">{children}</div>
    </div>
  );
}

export function EventDetails({ event }: EventDetailsProps) {
  const format = useFormatter();
  const t = useTranslations('events');
  const eventData = event.data as Record<string, unknown>;

  // Extract data from Sentry event
  const logentry = eventData.logentry as
    | {
        message?: string;
        formatted?: string;
        params?: unknown;
      }
    | undefined;

  const request = eventData.request as
    | {
        method?: string;
        url?: string;
        headers?: Record<string, string>;
        env?: Record<string, string>;
        data?: unknown;
        query_string?: string;
      }
    | undefined;

  const modules = eventData.modules as Record<string, string> | undefined;
  const extra = eventData.extra as Record<string, unknown> | undefined;
  const transaction = eventData.transaction as string | undefined;

  const exception = eventData.exception as
    | {
        values?: Array<{
          mechanism?: {
            type?: string;
            handled?: boolean;
          };
        }>;
      }
    | undefined;

  const mechanism = exception?.values?.[0]?.mechanism;

  return (
    <div className="space-y-6">
      {/* Key Info */}
      <Section title={t('details.keyInformation')}>
        <DetailRow
          label={t('details.eventId')}
          value={event.event_id}
          mono
          copyable
        />
        <DetailRow
          label={t('details.issueId')}
          value={event.issue_id}
          mono
          copyable
        />
        <DetailRow label={t('details.transaction')} value={transaction} />
        <DetailRow
          label={t('details.timestamp')}
          value={format.dateTime(new Date(event.timestamp), 'precise')}
        />
        <DetailRow
          label={t('details.ingestedAt')}
          value={format.dateTime(new Date(event.ingested_at), 'precise')}
        />
        <DetailRow label={t('details.level')} value={event.level} />
        {mechanism?.handled !== undefined && (
          <DetailRow label={t('details.handled')} value={mechanism.handled} />
        )}
        {mechanism?.type && (
          <DetailRow label={t('details.mechanism')} value={mechanism.type} />
        )}
      </Section>

      {/* Log Entry (if present) */}
      {logentry && (logentry.message || logentry.formatted) && (
        <Section title={t('details.logEntry')}>
          <DetailRow label={t('details.message')} value={logentry.message} />
          <DetailRow
            label={t('details.formatted')}
            value={logentry.formatted}
          />
          {logentry.params !== undefined && logentry.params !== null && (
            <DetailRow
              label={t('details.params')}
              value={JSON.stringify(logentry.params, null, 2)}
              mono
            />
          )}
        </Section>
      )}

      {/* Deployment Info */}
      <Section title={t('details.deployment')}>
        <DetailRow label={t('details.platform')} value={event.platform} />
        <DetailRow label={t('details.environment')} value={event.environment} />
        <DetailRow label={t('details.release')} value={event.release} mono />
        <DetailRow label={t('details.serverName')} value={event.server_name} />
      </Section>

      {/* SDK Info */}
      {(event.sdk_name || event.sdk_version) && (
        <Section title={t('details.sdk')}>
          <DetailRow label={t('details.name')} value={event.sdk_name} />
          <DetailRow
            label={t('details.version')}
            value={event.sdk_version}
            mono
          />
        </Section>
      )}

      {/* Request Info (if present) */}
      {request && (request.method || request.url) && (
        <Section title={t('details.request')}>
          <DetailRow label={t('details.method')} value={request.method} />
          <DetailRow label={t('details.url')} value={request.url} mono />
          {request.query_string && (
            <DetailRow
              label={t('details.queryString')}
              value={request.query_string}
              mono
            />
          )}
          {request.headers && Object.keys(request.headers).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {t('details.headers')}
              </p>
              {Object.entries(request.headers).map(([key, value]) => (
                <DetailRow key={key} label={key} value={value} mono />
              ))}
            </div>
          )}
          {request.env && Object.keys(request.env).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {t('details.environment')}
              </p>
              {Object.entries(request.env).map(([key, value]) => (
                <DetailRow key={key} label={key} value={value} mono />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Modules (if present) */}
      {modules && Object.keys(modules).length > 0 && (
        <Section title={t('details.modules')}>
          <div className="max-h-64 overflow-auto">
            {Object.entries(modules).map(([name, version]) => (
              <DetailRow key={name} label={name} value={version} mono />
            ))}
          </div>
        </Section>
      )}

      {/* Extra Data (if present) */}
      {extra && Object.keys(extra).length > 0 && (
        <Section title={t('details.extraData')}>
          {Object.entries(extra).map(([key, value]) => (
            <DetailRow
              key={key}
              label={key}
              value={
                typeof value === 'object'
                  ? JSON.stringify(value, null, 2)
                  : String(value)
              }
              mono={typeof value === 'object'}
            />
          ))}
        </Section>
      )}
    </div>
  );
}
