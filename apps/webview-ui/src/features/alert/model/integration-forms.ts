import type { AlertIntegration } from '@rustrak/client';
import { z } from 'zod';
import type { Translate } from '@/shared/lib/error-copy';
import type { ServerFieldMap } from '@/shared/lib/form-errors';

/**
 * What each provider's configuration dialog collects, and what a server error
 * about it is called on the way back.
 *
 * Every one of these forms renders flat inputs and posts them nested inside a
 * single opaque `credentials` object, so a `FieldError.field` is a dot path
 * into *the request body*: `credentials.webhook_url`, never `webhook_url`.
 * Without the maps below the path matches no registered name and the message
 * falls back to the form-level slot, which is safe but strictly less useful
 * than marking the input the user has to fix. `name` and `is_enabled` are
 * genuine top-level body keys and need no entry.
 */

export const WEBHOOK_FIELD_MAP: ServerFieldMap = {
  'credentials.url': 'url',
  'credentials.secret': 'secret',
};

export const SLACK_FIELD_MAP: ServerFieldMap = {
  'credentials.webhook_url': 'webhook_url',
  'credentials.token': 'token',
};

export const EMAIL_FIELD_MAP: ServerFieldMap = {
  'credentials.smtp_host': 'smtp_host',
  'credentials.smtp_port': 'smtp_port',
  'credentials.smtp_username': 'smtp_username',
  'credentials.smtp_password': 'smtp_password',
  'credentials.from_address': 'from_address',
};

/* -------------------------------------------------------------------------- */
/* Schemas -- credentials only, no routing fields                              */
/* -------------------------------------------------------------------------- */

export function webhookFormSchema(t: Translate) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(255),
    // url is optional: per-rule routing_override.url can supply it
    url: z
      .string()
      .optional()
      .refine(
        (v) =>
          !v ||
          v.trim() === '' ||
          v.startsWith('http://') ||
          v.startsWith('https://'),
        { message: t('validation.validHttpUrl') },
      ),
    secret: z.string().optional(),
    is_enabled: z.boolean(),
  });
}

/**
 * Why this incoming-webhook URL cannot be used, or `null`.
 *
 * The host check is not pedantry: a well-formed URL pointing anywhere else
 * accepts the POST and drops it, so the integration would look configured and
 * silently deliver nothing.
 */
function slackWebhookUrlProblem(
  url: string | undefined,
  t: Translate,
): string | null {
  if (!url || url.trim() === '') return t('validation.webhookUrlRequired');

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return t('validation.validUrl');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'hooks.slack.com') {
    return t('validation.slackWebhookUrl');
  }

  return null;
}

/**
 * Why this bot token cannot be used, or `null`.
 *
 * Blank while editing is the one case that is not an answer at all: the server
 * never returns the stored token, so an untouched field means "leave it alone".
 */
function slackTokenProblem(
  token: string | undefined,
  isEdit: boolean,
  t: Translate,
): string | null {
  if (!token || token.trim() === '') {
    return isEdit ? null : t('validation.botTokenRequired');
  }

  if (!token.startsWith('xoxb-')) return t('validation.botTokenPrefix');

  return null;
}

export function slackFormSchema(t: Translate) {
  return (
    z
      .object({
        name: z.string().min(1, t('validation.nameRequired')).max(255),
        method: z.enum(['webhook', 'bot_token']),
        is_edit: z.boolean(),
        webhook_url: z.string().optional(),
        token: z.string().optional(),
        is_enabled: z.boolean(),
      })
      // The two methods are alternatives, so exactly one field is judged and at
      // most one issue is raised: marking the input the chosen method does not
      // use would be an error the user cannot see, let alone fix.
      .superRefine((data, ctx) => {
        const [path, problem] =
          data.method === 'webhook'
            ? ([
                'webhook_url',
                slackWebhookUrlProblem(data.webhook_url, t),
              ] as const)
            : ([
                'token',
                slackTokenProblem(data.token, data.is_edit, t),
              ] as const);

        if (problem) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: problem,
            path: [path],
          });
        }
      })
  );
}

export function emailFormSchema(t: Translate) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(255),
    smtp_host: z.string().min(1, t('validation.smtpHostRequired')),
    smtp_port: z.number().int().min(1).max(65535),
    smtp_username: z.string().optional(),
    smtp_password: z.string().optional(),
    from_address: z.email(t('validation.validEmail')),
    is_enabled: z.boolean(),
  });
}
export type WebhookFormData = z.infer<ReturnType<typeof webhookFormSchema>>;
export type SlackFormData = z.infer<ReturnType<typeof slackFormSchema>>;
export type EmailFormData = z.infer<ReturnType<typeof emailFormSchema>>;
export type SlackMethod = 'webhook' | 'bot_token';

/* -------------------------------------------------------------------------- */
/* Seeds -- what an existing integration puts in the form                      */
/* -------------------------------------------------------------------------- */

export function webhookDefaults(
  integration: AlertIntegration | null,
): WebhookFormData {
  const creds = (integration?.credentials ?? {}) as {
    url?: string;
    secret?: string;
  };
  return {
    name: integration?.name ?? '',
    url: creds.url ?? '',
    secret: creds.secret ?? '',
    is_enabled: integration?.is_enabled ?? true,
  };
}

export function slackDefaults(
  integration: AlertIntegration | null,
): SlackFormData {
  const creds = (integration?.credentials ?? {}) as {
    method?: SlackMethod;
    webhook_url?: string;
  };
  return {
    name: integration?.name ?? '',
    method: creds.method ?? 'webhook',
    is_edit: integration !== null,
    webhook_url: creds.webhook_url ?? '',
    // Never seeded from the integration: the server does not return the bot
    // token, and an empty field means "leave the stored one alone".
    token: '',
    is_enabled: integration?.is_enabled ?? true,
  };
}

export function emailDefaults(
  integration: AlertIntegration | null,
): EmailFormData {
  const creds = (integration?.credentials ?? {}) as {
    smtp_host?: string;
    smtp_port?: number;
    smtp_username?: string;
    from_address?: string;
  };
  return {
    name: integration?.name ?? '',
    smtp_host: creds.smtp_host ?? '',
    smtp_port: creds.smtp_port ?? 587,
    smtp_username: creds.smtp_username ?? '',
    // Never seeded from the integration: the server does not return the SMTP
    // password, and an empty field means "leave the stored one alone".
    smtp_password: '',
    from_address: creds.from_address ?? '',
    is_enabled: integration?.is_enabled ?? true,
  };
}
