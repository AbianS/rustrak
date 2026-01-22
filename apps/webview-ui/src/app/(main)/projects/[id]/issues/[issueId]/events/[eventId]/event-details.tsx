'use client';

import type { EventDetail } from '@rustrak/client';
import { format } from 'date-fns';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

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
  const [copied, setCopied] = useState(false);

  if (value === null || value === undefined || value === '') return null;

  const displayValue =
    typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayValue);
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
      <Section title="Key Information">
        <DetailRow label="Event ID" value={event.event_id} mono copyable />
        <DetailRow label="Issue ID" value={event.issue_id} mono copyable />
        <DetailRow label="Transaction" value={transaction} />
        <DetailRow
          label="Timestamp"
          value={format(new Date(event.timestamp), 'PPpp')}
        />
        <DetailRow
          label="Ingested At"
          value={format(new Date(event.ingested_at), 'PPpp')}
        />
        <DetailRow label="Level" value={event.level} />
        {mechanism?.handled !== undefined && (
          <DetailRow label="Handled" value={mechanism.handled} />
        )}
        {mechanism?.type && (
          <DetailRow label="Mechanism" value={mechanism.type} />
        )}
      </Section>

      {/* Log Entry (if present) */}
      {logentry && (logentry.message || logentry.formatted) && (
        <Section title="Log Entry">
          <DetailRow label="Message" value={logentry.message} />
          <DetailRow label="Formatted" value={logentry.formatted} />
          {logentry.params !== undefined && logentry.params !== null && (
            <DetailRow
              label="Params"
              value={JSON.stringify(logentry.params, null, 2)}
              mono
            />
          )}
        </Section>
      )}

      {/* Deployment Info */}
      <Section title="Deployment">
        <DetailRow label="Platform" value={event.platform} />
        <DetailRow label="Environment" value={event.environment} />
        <DetailRow label="Release" value={event.release} mono />
        <DetailRow label="Server Name" value={event.server_name} />
      </Section>

      {/* SDK Info */}
      {(event.sdk_name || event.sdk_version) && (
        <Section title="SDK">
          <DetailRow label="Name" value={event.sdk_name} />
          <DetailRow label="Version" value={event.sdk_version} mono />
        </Section>
      )}

      {/* Request Info (if present) */}
      {request && (request.method || request.url) && (
        <Section title="Request">
          <DetailRow label="Method" value={request.method} />
          <DetailRow label="URL" value={request.url} mono />
          {request.query_string && (
            <DetailRow label="Query String" value={request.query_string} mono />
          )}
          {request.headers && Object.keys(request.headers).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Headers
              </p>
              {Object.entries(request.headers).map(([key, value]) => (
                <DetailRow key={key} label={key} value={value} mono />
              ))}
            </div>
          )}
          {request.env && Object.keys(request.env).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Environment
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
        <Section title="Modules">
          <div className="max-h-64 overflow-auto">
            {Object.entries(modules).map(([name, version]) => (
              <DetailRow key={name} label={name} value={version} mono />
            ))}
          </div>
        </Section>
      )}

      {/* Extra Data (if present) */}
      {extra && Object.keys(extra).length > 0 && (
        <Section title="Extra Data">
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
