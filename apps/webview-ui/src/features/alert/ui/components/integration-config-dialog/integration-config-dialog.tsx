'use client';

import type { AlertIntegration, ProviderType } from '@rustrak/client';
import { cn } from '@/shared/lib/utils';
import { Dialog, DialogContent } from '@/shared/ui/components/shadcn/dialog';
import { CustomWebhookForm } from './forms/custom-webhook-form';
import { EmailForm } from './forms/email-form';
import { SlackForm } from './forms/slack-form';
import { WebhookForm } from './forms/webhook-form';

export interface ConfigFormProps {
  onOpenChange: (open: boolean) => void;
  existingIntegration: AlertIntegration | null;
  onTest: (
    integration: AlertIntegration,
    routingOverride?: Record<string, unknown>,
  ) => void;
  onDelete: (integration: AlertIntegration) => void;
  isPending: boolean;
}

/**
 * One dialog for configuring an integration, whichever provider it is.
 *
 * This used to be three components mounted side by side, each with its own
 * `open={configureType === '…'}`, which meant all three existed at all times
 * and the shell around them was written out three times. The provider varies;
 * the dialog does not.
 *
 * `provider` doubling as the open flag is the point: there is no state in
 * which the dialog is open and no provider is chosen, so a separate `open`
 * would be a second source of truth for the same fact.
 */
export function IntegrationConfigDialog({
  provider,
  onOpenChange,
  ...formProps
}: {
  provider: ProviderType | null;
  onOpenChange: (open: boolean) => void;
} & Omit<ConfigFormProps, 'onOpenChange'>) {
  // Custom Webhook lays itself out in three bands — header, scrolling fields,
  // actions — so the shell hands it the height and gets out of the way: no
  // padding, no gap, and the popup is a column rather than the default grid.
  // Email is only tall, not banded, so it still scrolls as one piece.
  const banded = provider === 'custom_webhook';
  const tall = provider === 'email';

  return (
    <Dialog open={provider !== null} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'sm:max-w-lg',
          banded && 'flex max-h-[85dvh] flex-col gap-0 p-0',
          tall && 'max-h-[90dvh] overflow-y-auto',
        )}
      >
        <ConfigForm
          // Remounts when the dialog switches to another integration, so each
          // form seeds its defaults once and never needs a reset effect.
          key={`${provider}-${formProps.existingIntegration?.id ?? 'new'}`}
          provider={provider}
          onOpenChange={onOpenChange}
          {...formProps}
        />
      </DialogContent>
    </Dialog>
  );
}

function ConfigForm({
  provider,
  ...props
}: { provider: ProviderType | null } & ConfigFormProps) {
  switch (provider) {
    case 'slack':
      return <SlackForm {...props} />;
    case 'email':
      return <EmailForm {...props} />;
    case 'webhook':
      return <WebhookForm {...props} />;
    case 'custom_webhook':
      return <CustomWebhookForm {...props} />;
    default:
      // Closed, or a provider this build cannot configure. Rendering nothing
      // keeps the shell mounted so Base UI can play its close animation.
      return null;
  }
}
