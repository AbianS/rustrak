'use client';

import type { AlertIntegration } from '@rustrak/client';
import { useTranslations } from 'next-intl';
import { getSlackMethod } from '@/features/alert/lib/routing';
import { ProviderIcon } from '@/features/alert/ui/components/provider-icon';
import { cn } from '@/shared/lib/utils';
import { Switch } from '@/shared/ui/components/shadcn/switch';

/**
 * One integration, on or off.
 *
 * Selection moves the border and the icon's tint, never the card's background.
 * A card that fills in when selected competes with the routing block that
 * opens underneath it, and the two together read as one lit slab rather than
 * as a control and its detail.
 */
export function ChannelCard({
  integration,
  selected,
  disabled,
  onSelect,
}: {
  integration: AlertIntegration;
  selected: boolean;
  disabled: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const t = useTranslations('alerts');
  const isSlackBot =
    integration.provider_type === 'slack' &&
    getSlackMethod(integration) === 'bot_token';

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 transition-colors',
        selected ? 'border-primary/50' : 'border-border',
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex size-7 items-center justify-center rounded-md transition-colors',
            selected
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <ProviderIcon type={integration.provider_type} className="size-3.5" />
        </div>
        <div>
          <p className="text-sm font-medium leading-none">{integration.name}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
            {integration.provider_type}
            {isSlackBot ? ` · ${t('channelCard.botToken')}` : ''}
          </p>
        </div>
      </div>
      <Switch
        checked={selected}
        onCheckedChange={onSelect}
        disabled={disabled}
        size="sm"
      />
    </div>
  );
}
