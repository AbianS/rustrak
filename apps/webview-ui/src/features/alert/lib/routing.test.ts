import type { AlertIntegration, ProviderType } from '@rustrak/client';
import { describe, expect, it } from 'vitest';
import type { Translate } from '@/shared/lib/error-copy';
import {
  buildChannelsPayload,
  readRoutingOverride,
  routingNeedsOf,
  validateRoutingForIntegration,
} from './routing';

/** The key, so a test asserts which reason was given rather than its copy. */
const t: Translate = (key) => key;

function integration(
  provider_type: ProviderType,
  credentials: Record<string, unknown> = {},
  id = 1,
): AlertIntegration {
  return {
    id,
    name: `${provider_type} #${id}`,
    provider_type,
    credentials,
    is_enabled: true,
    failure_count: 0,
    last_failure_at: null,
    last_failure_message: null,
    last_success_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as AlertIntegration;
}

describe('routingNeedsOf', () => {
  it('asks a Slack bot for a channel and nothing else', () => {
    expect(
      routingNeedsOf(integration('slack', { method: 'bot_token' })),
    ).toEqual({
      needsChannel: true,
      needsRecipients: false,
      needsUrl: false,
      hasRoutingFields: true,
    });
  });

  it('asks a Slack incoming webhook for nothing: the URL is the channel', () => {
    expect(routingNeedsOf(integration('slack', { method: 'webhook' }))).toEqual(
      {
        needsChannel: false,
        needsRecipients: false,
        needsUrl: false,
        hasRoutingFields: false,
      },
    );
  });

  it('treats a Slack integration with no method as an incoming webhook', () => {
    expect(routingNeedsOf(integration('slack')).needsChannel).toBe(false);
  });

  it('always asks email for recipients', () => {
    expect(routingNeedsOf(integration('email'))).toEqual({
      needsChannel: false,
      needsRecipients: true,
      needsUrl: false,
      hasRoutingFields: true,
    });
  });

  it('requires a URL from a webhook that carries none', () => {
    expect(routingNeedsOf(integration('webhook'))).toEqual({
      needsChannel: false,
      needsRecipients: false,
      needsUrl: true,
      hasRoutingFields: true,
    });
  });

  it('offers but does not require a URL when the webhook already has one', () => {
    const needs = routingNeedsOf(
      integration('webhook', { url: 'https://a.test' }),
    );
    expect(needs.needsUrl).toBe(false);
    expect(needs.hasRoutingFields).toBe(true);
  });
});

describe('validateRoutingForIntegration', () => {
  it('rejects a Slack bot with no channel', () => {
    expect(
      validateRoutingForIntegration(
        integration('slack', { method: 'bot_token' }),
        {},
        t,
      ),
    ).toBe('routing.slackChannelRequired');
  });

  it('rejects a Slack bot whose channel is only whitespace', () => {
    expect(
      validateRoutingForIntegration(
        integration('slack', { method: 'bot_token' }),
        { channel: '   ' },
        t,
      ),
    ).toBe('routing.slackChannelRequired');
  });

  it('accepts a Slack bot with a channel', () => {
    expect(
      validateRoutingForIntegration(
        integration('slack', { method: 'bot_token' }),
        { channel: '#alerts' },
        t,
      ),
    ).toBeNull();
  });

  it('accepts a Slack incoming webhook with no routing at all', () => {
    expect(
      validateRoutingForIntegration(
        integration('slack', { method: 'webhook' }),
        {},
        t,
      ),
    ).toBeNull();
  });

  it('rejects email with no recipients', () => {
    expect(validateRoutingForIntegration(integration('email'), {}, t)).toBe(
      'routing.recipientsRequired',
    );
  });

  it('rejects a recipients line that parses to nothing', () => {
    expect(
      validateRoutingForIntegration(
        integration('email'),
        { recipients: ' , ' },
        t,
      ),
    ).toBe('routing.invalidRecipients');
  });

  it('rejects a recipient that is not an address', () => {
    expect(
      validateRoutingForIntegration(
        integration('email'),
        { recipients: 'ops@a.test, not-an-address' },
        t,
      ),
    ).toBe('routing.invalidRecipients');
  });

  it('accepts a comma-separated recipients line', () => {
    expect(
      validateRoutingForIntegration(
        integration('email'),
        { recipients: 'ops@a.test, sre@a.test' },
        t,
      ),
    ).toBeNull();
  });

  it('rejects a webhook with neither a stored nor an override URL', () => {
    expect(validateRoutingForIntegration(integration('webhook'), {}, t)).toBe(
      'routing.webhookUrlRequired',
    );
  });

  it('accepts a webhook whose URL comes from its credentials', () => {
    expect(
      validateRoutingForIntegration(
        integration('webhook', { url: 'https://a.test' }),
        {},
        t,
      ),
    ).toBeNull();
  });

  it('rejects an override URL that is not http(s)', () => {
    expect(
      validateRoutingForIntegration(
        integration('webhook', { url: 'https://a.test' }),
        { url: 'ftp://a.test' },
        t,
      ),
    ).toBe('routing.invalidOverrideUrl');
  });

  it('accepts an http override URL', () => {
    expect(
      validateRoutingForIntegration(
        integration('webhook'),
        { url: 'http://a.test' },
        t,
      ),
    ).toBeNull();
  });
});

describe('buildChannelsPayload', () => {
  it('sends a trimmed channel for a Slack bot', () => {
    const slack = integration('slack', { method: 'bot_token' }, 7);
    expect(
      buildChannelsPayload([7], { 7: { channel: ' #alerts ' } }, [slack]),
    ).toEqual([
      { integration_id: 7, routing_override: { channel: '#alerts' } },
    ]);
  });

  it('sends nothing for a Slack incoming webhook, even with a channel typed', () => {
    const slack = integration('slack', { method: 'webhook' }, 7);
    expect(
      buildChannelsPayload([7], { 7: { channel: '#alerts' } }, [slack]),
    ).toEqual([{ integration_id: 7, routing_override: {} }]);
  });

  it('splits email recipients into the list the API expects', () => {
    const email = integration('email', {}, 3);
    expect(
      buildChannelsPayload(
        [3],
        { 3: { recipients: 'ops@a.test, , sre@a.test' } },
        [email],
      ),
    ).toEqual([
      {
        integration_id: 3,
        routing_override: { recipients: ['ops@a.test', 'sre@a.test'] },
      },
    ]);
  });

  it('omits a blank override rather than clearing the stored value', () => {
    const webhook = integration('webhook', { url: 'https://a.test' }, 5);
    expect(buildChannelsPayload([5], { 5: { url: '' } }, [webhook])).toEqual([
      { integration_id: 5, routing_override: {} },
    ]);
  });

  it('skips a selected id no integration matches', () => {
    expect(
      buildChannelsPayload([99], {}, [integration('email', {}, 3)]),
    ).toEqual([]);
  });
});

describe('readRoutingOverride', () => {
  it('joins an email recipients list back into the line the input binds to', () => {
    expect(
      readRoutingOverride(integration('email'), {
        recipients: ['ops@a.test', 'sre@a.test'],
      }),
    ).toEqual({ recipients: 'ops@a.test, sre@a.test' });
  });

  it('reads nothing for email when recipients is not a list', () => {
    expect(
      readRoutingOverride(integration('email'), { recipients: 'x' }),
    ).toEqual({});
  });

  it('passes a Slack channel through', () => {
    expect(
      readRoutingOverride(integration('slack', { method: 'bot_token' }), {
        channel: '#alerts',
      }),
    ).toEqual({ channel: '#alerts' });
  });

  it('drops a non-string override value, which no input could hold', () => {
    expect(
      readRoutingOverride(integration('webhook'), {
        url: 'https://a.test',
        retries: 3,
      }),
    ).toEqual({ url: 'https://a.test' });
  });

  it('falls back to plain string fields when the integration is gone', () => {
    expect(readRoutingOverride(undefined, { channel: '#alerts' })).toEqual({
      channel: '#alerts',
    });
  });

  it('round-trips what buildChannelsPayload wrote', () => {
    const email = integration('email', {}, 3);
    const [channel] = buildChannelsPayload(
      [3],
      { 3: { recipients: 'ops@a.test, sre@a.test' } },
      [email],
    );
    expect(readRoutingOverride(email, channel.routing_override)).toEqual({
      recipients: 'ops@a.test, sre@a.test',
    });
  });
});
