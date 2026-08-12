import { z } from 'zod';
import type { Translate } from '@/shared/lib/error-copy';

/**
 * What the alert rule dialog collects.
 *
 * `routing_map` is optional and, in practice, never written by the form: per
 * channel routing is held outside the schema by `useChannelRouting`, because
 * which fields a channel needs depends on the provider it points at and
 * cannot be expressed as a fixed shape here.
 */

export function alertRuleFormSchema(t: Translate) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(255),
    alert_type: z.enum(['new_issue', 'regression', 'unmute']),
    selected_integration_ids: z.array(z.number()),
    routing_map: z
      .record(z.string(), z.record(z.string(), z.string()))
      .optional(),
    is_enabled: z.boolean(),
    cooldown_minutes: z.number().int().min(0),
  });
}

export type AlertRuleFormData = z.infer<ReturnType<typeof alertRuleFormSchema>>;
