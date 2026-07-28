import type { AlertIntegration } from '@rustrak/client';

/**
 * Per-channel `routing_override`, keyed by integration id.
 *
 * Deliberately outside the form schema. What a channel needs to be routed
 * depends on the provider it points at, so it cannot be expressed as a fixed
 * set of Zod fields; it is assembled at submit time by `buildChannelsPayload`.
 */
export type RoutingMap = Record<number, Record<string, string>>;

export function getSlackMethod(integration: AlertIntegration): string {
  return (
    ((integration.credentials as Record<string, unknown>).method as string) ??
    'webhook'
  );
}

/**
 * Which routing inputs a channel has to show, derived from the integration
 * rather than from the provider name alone.
 *
 * A webhook that already carries a URL in its credentials still offers the
 * override field, but does not require it; one that does not, requires it.
 * That distinction is the reason this is a function and not a lookup table.
 */
export function routingNeedsOf(integration: AlertIntegration): {
  needsChannel: boolean;
  needsRecipients: boolean;
  needsUrl: boolean;
  hasRoutingFields: boolean;
} {
  const isSlackBot =
    integration.provider_type === 'slack' &&
    getSlackMethod(integration) === 'bot_token';
  const needsRecipients = integration.provider_type === 'email';
  const credUrl = (integration.credentials as Record<string, unknown>).url as
    | string
    | undefined;
  const needsUrl = integration.provider_type === 'webhook' && !credUrl;

  return {
    needsChannel: isSlackBot,
    needsRecipients,
    needsUrl,
    hasRoutingFields:
      isSlackBot || needsRecipients || integration.provider_type === 'webhook',
  };
}

export function validateRoutingForIntegration(
  integration: AlertIntegration,
  routing: Record<string, string>,
): string | null {
  if (integration.provider_type === 'slack') {
    if (getSlackMethod(integration) === 'bot_token') {
      if (!routing.channel || routing.channel.trim() === '') {
        return `Slack channel is required for "${integration.name}"`;
      }
    }
  }
  if (integration.provider_type === 'email') {
    if (!routing.recipients || routing.recipients.trim() === '') {
      return `Recipients are required for "${integration.name}"`;
    }
    const addrs = routing.recipients
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    if (addrs.length === 0 || addrs.some((a) => !a.includes('@'))) {
      return `Invalid email address in recipients for "${integration.name}"`;
    }
  }
  if (integration.provider_type === 'webhook') {
    const credUrl = (integration.credentials as Record<string, unknown>).url as
      | string
      | undefined;
    const routeUrl = routing.url?.trim();
    if (!credUrl && !routeUrl) {
      return `A webhook URL is required for "${integration.name}" (set in credentials or as override URL)`;
    }
    if (
      routeUrl &&
      !routeUrl.startsWith('http://') &&
      !routeUrl.startsWith('https://')
    ) {
      return `Override URL for "${integration.name}" must be http/https`;
    }
  }
  return null;
}

/**
 * Every selected channel that fails its own routing rules, keyed by id.
 *
 * An id the caller selected but that no longer exists in `integrations` is
 * skipped rather than reported: it is not a routing mistake the user can fix
 * in this form.
 */
export function collectRoutingErrors(
  selectedIds: readonly number[],
  routingMap: RoutingMap,
  integrations: readonly AlertIntegration[],
): Record<number, string> {
  const errors: Record<number, string> = {};
  for (const id of selectedIds) {
    const integration = integrations.find((i) => i.id === id);
    if (!integration) continue;
    const err = validateRoutingForIntegration(
      integration,
      routingMap[id] ?? {},
    );
    if (err) errors[id] = err;
  }
  return errors;
}

/**
 * The `channels` array the API expects.
 *
 * Only the fields that provider actually routes on are sent: an empty
 * `routing_override` means "use the integration's own credentials", so
 * forwarding blank strings would overwrite a configured value with nothing.
 */
export function buildChannelsPayload(
  selectedIds: readonly number[],
  routingMap: RoutingMap,
  integrations: readonly AlertIntegration[],
): { integration_id: number; routing_override: Record<string, unknown> }[] {
  return selectedIds.flatMap((id) => {
    const routing = routingMap[id] ?? {};
    const integration = integrations.find((i) => i.id === id);
    if (!integration) return [];
    const routingOverride: Record<string, unknown> = {};

    if (
      integration.provider_type === 'slack' &&
      getSlackMethod(integration) === 'bot_token'
    ) {
      if (routing.channel) routingOverride.channel = routing.channel.trim();
    }
    if (integration.provider_type === 'email' && routing.recipients) {
      routingOverride.recipients = routing.recipients
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
    }
    if (integration.provider_type === 'webhook' && routing.url) {
      routingOverride.url = routing.url.trim();
    }

    return [{ integration_id: id, routing_override: routingOverride }];
  });
}
