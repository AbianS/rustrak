import type { AlertIntegration } from '@rustrak/client';
import { z } from 'zod';
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

export const webhookFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
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
      { message: 'Must be a valid http/https URL' },
    ),
  secret: z.string().optional(),
  is_enabled: z.boolean(),
});

export const slackFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    method: z.enum(['webhook', 'bot_token']),
    is_edit: z.boolean(),
    webhook_url: z.string().optional(),
    token: z.string().optional(),
    is_enabled: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'webhook') {
      if (!data.webhook_url || data.webhook_url.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Webhook URL is required',
          path: ['webhook_url'],
        });
      } else {
        try {
          const url = new URL(data.webhook_url);
          if (url.protocol !== 'https:' || url.hostname !== 'hooks.slack.com') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                'Must be a valid Slack webhook URL (https://hooks.slack.com/...)',
              path: ['webhook_url'],
            });
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please enter a valid URL',
            path: ['webhook_url'],
          });
        }
      }
    } else if (data.method === 'bot_token') {
      const tokenEmpty = !data.token || data.token.trim() === '';
      if (data.is_edit && tokenEmpty) {
        // Blank on edit = keep existing — OK
        return;
      }
      if (tokenEmpty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bot token is required',
          path: ['token'],
        });
      } else if (!data.token!.startsWith('xoxb-')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bot token must start with xoxb-',
          path: ['token'],
        });
      }
    }
  });

export const emailFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  smtp_host: z.string().min(1, 'SMTP host is required'),
  smtp_port: z.number().int().min(1).max(65535),
  smtp_username: z.string().optional(),
  smtp_password: z.string().optional(),
  from_address: z.string().email('Please enter a valid email'),
  is_enabled: z.boolean(),
});
export type WebhookFormData = z.infer<typeof webhookFormSchema>;
export type SlackFormData = z.infer<typeof slackFormSchema>;
export type EmailFormData = z.infer<typeof emailFormSchema>;
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
