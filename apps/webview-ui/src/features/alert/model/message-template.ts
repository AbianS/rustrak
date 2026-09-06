/**
 * What the Custom Webhook's message-body editor offers the reader.
 *
 * No provider shapes live here. Rustrak posts whatever body you write and
 * judges the delivery by the HTTP status, the way Grafana's Custom Payload,
 * Uptime Kuma's Custom Body and Alertmanager's webhook receiver all do; the
 * message shapes particular services expect are documented examples, in
 * `apps/docs/content/usage/alerts.mdx`, rather than code anyone has to keep
 * up to date here.
 */

/**
 * Where the field's help button goes: the page that documents the body
 * template on its own, rather than a paragraph in the alerts page.
 */
export const TEMPLATE_DOCS_URL =
  'https://rustrak.github.io/rustrak/usage/alerts/message-body-template';

/**
 * The textarea's placeholder: a minimal body, not copy. Held here rather
 * than in the message dictionaries because braces are configuration, and ICU
 * would read them as argument markers.
 *
 * The example interpolates through `| tojson` so it renders valid JSON even
 * for a title containing quotes, which is the same discipline the variable
 * chips apply and the docs teach.
 */
export const templatePlaceholder =
  '{"text":{{ ("Rustrak: " ~ issue.title) | tojson }}}';

/**
 * The payload fields the editor offers as chips.
 *
 * Every snippet goes through `| tojson`, which is the reason the chips exist:
 * a title carrying a quote breaks a hand-written body, and nobody should have
 * to learn that before their first alert works. The full list of fields lives
 * in the docs; these are the ones a message actually uses.
 */
export interface TemplateVariable {
  path: string;
  snippet: string;
  /** The rendered type, shown beside the name the way an editor shows one. */
  detail: string;
  /** Key under `alerts.customWebhook.variables`, one short line. */
  descriptionKey: string;
  /** What this field holds in the sample payload, so the list reads concretely. */
  example: string;
}

const variable = (
  path: string,
  detail: string,
  example: string,
): TemplateVariable => ({
  path,
  snippet: `{{ ${path} | tojson }}`,
  detail,
  descriptionKey: path,
  example,
});

/**
 * Every field of the alert payload, in the order the editor offers them: the
 * ones a message is actually built from first, the bookkeeping last.
 */
export const TEMPLATE_VARIABLES: readonly TemplateVariable[] = [
  variable('issue.title', 'string', 'Sample issue'),
  variable('issue.short_id', 'string', 'SAMPLE-1'),
  variable('issue.level', 'string | null', 'error'),
  variable('issue.event_count', 'number', '1'),
  variable('issue.id', 'string', '00000000-0000-0000-0000-000000000000'),
  variable('issue.first_seen', 'timestamp', '2026-01-01T00:00:00Z'),
  variable('issue.last_seen', 'timestamp', '2026-01-01T00:00:00Z'),
  variable('issue_url', 'string', 'https://rustrak.example/issues/sample'),
  variable('project.name', 'string', 'Sample Project'),
  variable('project.slug', 'string', 'sample-project'),
  variable('project.id', 'number', '1'),
  variable('alert_type', 'string', 'new_issue'),
  variable('alert_id', 'string', '00000000-0000-0000-0000-000000000000'),
  variable('triggered_at', 'timestamp', '2026-01-01T00:00:00Z'),
  variable('actor', 'string', 'Rustrak'),
];

/** The handful the chip row shows; the rest are one keystroke away in the editor. */
export const QUICK_VARIABLES: readonly TemplateVariable[] =
  TEMPLATE_VARIABLES.filter((v) =>
    [
      'issue.title',
      'issue.short_id',
      'issue.level',
      'project.name',
      'issue_url',
    ].includes(v.path),
  );
