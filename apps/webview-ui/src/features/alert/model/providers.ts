import type { ProviderType } from '@rustrak/client';

/**
 * The notification providers this build can configure, in the order they are
 * offered.
 *
 * Data only: the mark for each one lives in `ProviderIcon`, so this table
 * stays free of React and the same list can answer "what can I connect?"
 * without rendering anything.
 *
 * `color` is the provider's own brand swatch, which is why these are literals
 * rather than theme tokens: Slack aubergine does not have a light and a dark
 * variant, and reading it off the theme would make the tile stop being
 * recognisably Slack.
 */
export const alertProviders: {
  type: ProviderType;
  name: string;
  descriptionKey: string;
  color: string;
}[] = [
  {
    type: 'slack',
    name: 'Slack',
    descriptionKey: 'providers.slack.description',
    color: 'bg-[#4A154B]',
  },
  {
    type: 'email',
    name: 'Email',
    descriptionKey: 'providers.email.description',
    color: 'bg-[#0066CC]',
  },
  {
    type: 'webhook',
    name: 'Webhook',
    descriptionKey: 'providers.webhook.description',
    color: 'bg-orange-600',
  },
  {
    type: 'custom_webhook',
    name: 'Custom Webhook',
    descriptionKey: 'providers.customWebhook.description',
    color: 'bg-emerald-600',
  },
];
