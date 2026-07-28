'use client';

import type { AlertIntegration } from '@rustrak/client';
import { useId } from 'react';
import { routingNeedsOf } from '@/features/alert/lib/routing';
import { Input } from '@/shared/ui/components/shadcn/input';
import { Textarea } from '@/shared/ui/components/shadcn/textarea';

/**
 * One labelled routing input, so the three below differ only in their control.
 *
 * `children` is a render prop rather than a node because the label has to
 * point at the control by id. These are not `FormField`s — the routing map
 * lives outside the form schema — so nothing else is generating that pairing,
 * and the three labels here were previously attached to nothing at all.
 */
function Row({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required: boolean;
  hint?: React.ReactNode;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
  }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? (
          <span className="text-destructive"> *</span>
        ) : (
          <span className="text-muted-foreground/60"> (optional)</span>
        )}
      </label>
      {children({ id, 'aria-describedby': hint ? hintId : undefined })}
      {hint && (
        <p id={hintId} className="text-[10px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Where a selected channel is routed, which depends entirely on its provider.
 *
 * Rendered as a block attached under the channel's card rather than inside it,
 * so a channel with three inputs and one with none stay the same height in the
 * list until they are switched on.
 */
export function ChannelRoutingFields({
  integration,
  routing,
  error,
  disabled,
  onChange,
}: {
  integration: AlertIntegration;
  routing: Record<string, string>;
  error?: string;
  disabled: boolean;
  onChange: (field: string, value: string) => void;
}) {
  const { needsChannel, needsRecipients, needsUrl } =
    routingNeedsOf(integration);

  return (
    <div className="mx-3 rounded-b-lg border border-t-0 border-primary/20 bg-muted/40 px-3 py-3 space-y-3">
      {needsChannel && (
        <Row
          label="Channel"
          required
          hint={
            <>
              Channel name (e.g. <code className="font-mono">#alerts</code>) or
              channel ID (e.g. <code className="font-mono">C1234567890</code>)
            </>
          }
        >
          {(a) => (
            <Input
              {...a}
              placeholder="#alerts or C1234567890"
              value={routing.channel ?? ''}
              onChange={(e) => onChange('channel', e.target.value)}
              disabled={disabled}
              className="h-8 text-sm"
              autoComplete="off"
            />
          )}
        </Row>
      )}

      {needsRecipients && (
        <Row label="Recipients" required hint="Comma-separated email addresses">
          {(a) => (
            <Textarea
              {...a}
              placeholder="alerts@example.com, team@example.com"
              value={routing.recipients ?? ''}
              onChange={(e) => onChange('recipients', e.target.value)}
              disabled={disabled}
              className="text-sm min-h-15 resize-none"
              autoComplete="off"
            />
          )}
        </Row>
      )}

      {integration.provider_type === 'webhook' && (
        <Row
          label="Override URL"
          required={needsUrl}
          hint={
            needsUrl ? undefined : 'Overrides the URL configured in credentials'
          }
        >
          {(a) => (
            <Input
              {...a}
              placeholder="https://svc.io/hook"
              value={routing.url ?? ''}
              onChange={(e) => onChange('url', e.target.value)}
              disabled={disabled}
              className="h-8 text-sm"
              autoComplete="off"
            />
          )}
        </Row>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
