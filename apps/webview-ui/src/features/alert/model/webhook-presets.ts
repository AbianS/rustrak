/**
 * Ready-made body templates for the Custom Webhook form.
 *
 * Each one is a Minijinja template that renders the exact JSON schema a
 * group-bot endpoint expects, so admins of the Chinese collaboration
 * platforms (WeCom, DingTalk, Feishu) can paste their bot URL, pick a
 * preset and get delivery without learning the template language first.
 *
 * Dynamic strings go through `| tojson`: a title containing a quote would
 * otherwise break the surrounding JSON, and tojson escapes whatever the
 * payload carries. The templates are configuration, not copy, so they are
 * deliberately not held in the message dictionaries — the labels beside
 * them are.
 *
 * The server's `custom_webhook.rs` tests render these same templates and
 * fail on invalid JSON; a change here should be mirrored there.
 */
export interface WebhookPreset {
  id: string;
  /** Key under `alerts.customWebhook.presets`. */
  labelKey: string;
  template: string;
  /**
   * The response envelope this platform answers with. Picking a preset also
   * picks it, because a body template and the reply it earns are one choice:
   * a WeCom template posted to WeCom wants WeCom's `errcode` read.
   */
  responseCheck: ResponseCheck;
}

/**
 * Which response envelope a delivery reads for a rejection hidden in a 2xx.
 * Mirrors the server's `BotResponseCheck`; `status_only` is the default and
 * means the body is not read at all, the way a generic webhook behaves.
 */
export type ResponseCheck = 'status_only' | 'wecom' | 'dingtalk' | 'feishu';

export const RESPONSE_CHECKS: readonly ResponseCheck[] = [
  'status_only',
  'wecom',
  'dingtalk',
  'feishu',
];

/**
 * The textarea's placeholder: a minimal body, not copy. Held here rather
 * than in the message dictionaries for the same reason as the presets —
 * braces are configuration, and ICU would read them as argument markers.
 *
 * The example interpolates through `| tojson` so it renders valid JSON even
 * for a title containing quotes — the same discipline the presets use and the
 * docs teach, so the placeholder never models a template the server would
 * reject.
 */
export const templatePlaceholder =
  '{"msgtype":"text","text":{"content":{{ ("Rustrak: " ~ issue.title) | tojson }}}}';

export const webhookPresets: readonly WebhookPreset[] = [
  {
    id: 'wecom_text',
    labelKey: 'wecomText',
    responseCheck: 'wecom',
    template:
      '{"msgtype":"text","text":{"content":' +
      '{{ ("Rustrak: " ~ issue.title ~ " (" ~ issue.short_id ~ ") " ~ issue_url) | tojson }}}}',
  },
  {
    id: 'wecom_markdown',
    labelKey: 'wecomMarkdown',
    responseCheck: 'wecom',
    template:
      '{"msgtype":"markdown","markdown":{"content":' +
      '{{ ("### " ~ issue.title ~ "\\n> Project: " ~ project.name ~ "\\n> Level: " ~ (issue.level or "unknown") ~ "\\n> [View issue](" ~ issue_url ~ ")") | tojson }}}}',
  },
  {
    id: 'dingtalk_text',
    labelKey: 'dingtalkText',
    responseCheck: 'dingtalk',
    template:
      '{"msgtype":"text","text":{"content":' +
      '{{ ("Rustrak: " ~ issue.title ~ " (" ~ issue.short_id ~ ") " ~ issue_url) | tojson }}}}',
  },
  {
    id: 'feishu_text',
    labelKey: 'feishuText',
    responseCheck: 'feishu',
    template:
      '{"msg_type":"text","content":{"text":' +
      '{{ ("Rustrak: " ~ issue.title ~ " (" ~ issue.short_id ~ ") " ~ issue_url) | tojson }}}}',
  },
];
