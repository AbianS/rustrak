import { describe, expect, it } from 'vitest';
import type { Translate } from '@/shared/lib/error-copy';
import {
  customWebhookDefaults,
  customWebhookFormSchema,
  slackFormSchema,
} from './integration-forms';

/** The key, so a test asserts which reason was given rather than its copy. */
const t: Translate = (key) => key;

const schema = slackFormSchema(t);

/** `[path, message]` for the first issue, or `null` when it parsed. */
function firstIssue(input: Record<string, unknown>): [string, string] | null {
  const result = schema.safeParse(input);
  if (result.success) return null;
  const issue = result.error.issues[0];
  return [issue.path.join('.'), issue.message];
}

const webhook = (webhook_url: string) => ({
  name: 'Slack',
  method: 'webhook',
  is_edit: false,
  webhook_url,
  token: '',
  is_enabled: true,
});

const bot = (token: string, is_edit: boolean) => ({
  name: 'Slack',
  method: 'bot_token',
  is_edit,
  webhook_url: '',
  token,
  is_enabled: true,
});

describe('slackFormSchema, incoming webhook', () => {
  it('requires a URL', () => {
    expect(firstIssue(webhook(''))).toEqual([
      'webhook_url',
      'validation.webhookUrlRequired',
    ]);
  });

  it('treats a whitespace URL as missing', () => {
    expect(firstIssue(webhook('   '))).toEqual([
      'webhook_url',
      'validation.webhookUrlRequired',
    ]);
  });

  it('rejects something that is not a URL at all', () => {
    expect(firstIssue(webhook('not a url'))).toEqual([
      'webhook_url',
      'validation.validUrl',
    ]);
  });

  it('rejects a non-Slack host', () => {
    expect(firstIssue(webhook('https://example.test/services/x'))).toEqual([
      'webhook_url',
      'validation.slackWebhookUrl',
    ]);
  });

  it('rejects plain http on the Slack host', () => {
    expect(firstIssue(webhook('http://hooks.slack.com/services/x'))).toEqual([
      'webhook_url',
      'validation.slackWebhookUrl',
    ]);
  });

  it('accepts a real Slack webhook URL', () => {
    expect(
      firstIssue(webhook('https://hooks.slack.com/services/T/B/x')),
    ).toBeNull();
  });
});

describe('slackFormSchema, bot token', () => {
  it('requires a token when creating', () => {
    expect(firstIssue(bot('', false))).toEqual([
      'token',
      'validation.botTokenRequired',
    ]);
  });

  it('treats a whitespace token as missing when creating', () => {
    expect(firstIssue(bot('   ', false))).toEqual([
      'token',
      'validation.botTokenRequired',
    ]);
  });

  it('accepts a blank token when editing: it means keep the stored one', () => {
    expect(firstIssue(bot('', true))).toBeNull();
  });

  it('rejects a token without the bot prefix', () => {
    expect(firstIssue(bot('xoxp-1234', true))).toEqual([
      'token',
      'validation.botTokenPrefix',
    ]);
  });

  it('accepts a bot token', () => {
    expect(firstIssue(bot('xoxb-1234', false))).toBeNull();
  });

  it('ignores the webhook URL entirely when the method is bot_token', () => {
    expect(
      firstIssue({ ...bot('xoxb-1234', false), webhook_url: 'nonsense' }),
    ).toBeNull();
  });
});

describe('slackFormSchema, shared fields', () => {
  it('requires a name whichever method is chosen', () => {
    expect(
      firstIssue({
        ...webhook('https://hooks.slack.com/services/T/B/x'),
        name: '',
      }),
    ).toEqual(['name', 'validation.nameRequired']);
  });
});

const cwSchema = customWebhookFormSchema(t);

/** `[path, message]` for the first issue of the custom-webhook schema. */
function firstCwIssue(input: Record<string, unknown>): [string, string] | null {
  const result = cwSchema.safeParse(input);
  if (result.success) return null;
  const issue = result.error.issues[0];
  return [issue.path.join('.'), issue.message];
}

const customWebhook = (over: Record<string, unknown>) => ({
  name: 'Ops chat bridge',
  url: 'https://example.com/hooks/incoming',
  secret: '',
  template: '{"msgtype":"text"}',
  is_enabled: true,
  ...over,
});

describe('customWebhookFormSchema', () => {
  it('accepts a filled form', () => {
    expect(firstCwIssue(customWebhook({}))).toBeNull();
  });

  it('requires a template', () => {
    expect(firstCwIssue(customWebhook({ template: '' }))).toEqual([
      'template',
      'validation.templateRequired',
    ]);
  });

  it('allows the URL to be blank for a routing override', () => {
    expect(firstCwIssue(customWebhook({ url: '' }))).toBeNull();
  });

  it('rejects a non-http URL', () => {
    expect(firstCwIssue(customWebhook({ url: 'ftp://example.test' }))).toEqual([
      'url',
      'validation.validHttpUrl',
    ]);
  });
});

describe('customWebhookDefaults', () => {
  it('seeds the stored template, which is configuration rather than a secret', () => {
    expect(
      customWebhookDefaults({
        id: 1,
        name: 'Ops bridge',
        provider_type: 'custom_webhook',
        credentials: { url: 'https://example.test/h', template: '{"a":1}' },
        is_enabled: true,
      } as never).template,
    ).toBe('{"a":1}');
  });

  it('leaves the secret blank so saving does not overwrite a working one', () => {
    expect(
      customWebhookDefaults({
        id: 1,
        name: 'Ops bridge',
        provider_type: 'custom_webhook',
        credentials: { url: 'https://example.test/h', template: '{}' },
        is_enabled: true,
      } as never).secret,
    ).toBe('');
  });
});
