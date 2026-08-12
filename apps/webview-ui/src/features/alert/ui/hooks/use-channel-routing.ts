'use client';

import type { AlertIntegration, AlertRule } from '@rustrak/client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  collectRoutingErrors,
  type RoutingMap,
} from '@/features/alert/lib/routing';

/**
 * The routing overrides an existing rule already carries, flattened into the
 * one-string-per-field shape the inputs bind to. Email is special-cased
 * because its `recipients` is a list on the wire and a comma-joined line in
 * the UI.
 */
function initialRoutingMap(
  existingRule: AlertRule | null,
  integrations: readonly AlertIntegration[],
): RoutingMap {
  if (!existingRule) return {};
  const byId = new Map(integrations.map((i) => [i.id, i]));
  const map: RoutingMap = {};
  for (const ch of existingRule.channels) {
    const override = ch.routing_override ?? {};
    const integration = byId.get(ch.integration_id);
    const normalized: Record<string, string> = {};
    if (integration?.provider_type === 'email') {
      const r = override.recipients;
      if (Array.isArray(r)) normalized.recipients = r.join(', ');
    } else {
      for (const [k, v] of Object.entries(override)) {
        if (typeof v === 'string') normalized[k] = v;
      }
    }
    map[ch.integration_id] = normalized;
  }
  return map;
}

export interface ChannelRouting {
  routingMap: RoutingMap;
  errors: Record<number, string>;
  /** Add or drop a channel's routing entry as it is switched on and off. */
  select: (integrationId: number, selected: boolean) => void;
  setField: (integrationId: number, field: string, value: string) => void;
  /** Validate the selection; returns false and shows errors when it fails. */
  validate: (selectedIds: readonly number[]) => boolean;
}

/**
 * The per-channel routing a rule sends through, and the errors it collected.
 *
 * These two pieces of state are always written together — selecting a channel
 * adds an entry and clears its error, editing a field updates it and clears
 * its error — and holding them in one hook is what stops a stale error sitting
 * under a field the user has already corrected.
 *
 * Seeded once at mount. The dialog body only exists while the dialog is open,
 * so mounting is the reset, and there is no adjustment effect to write.
 */
export function useChannelRouting(
  existingRule: AlertRule | null,
  integrations: readonly AlertIntegration[],
): ChannelRouting {
  const t = useTranslations('alerts');
  const [routingMap, setRoutingMap] = useState<RoutingMap>(() =>
    initialRoutingMap(existingRule, integrations),
  );
  const [errors, setErrors] = useState<Record<number, string>>({});

  const clearError = (integrationId: number) =>
    setErrors((prev) => {
      const next = { ...prev };
      delete next[integrationId];
      return next;
    });

  return {
    routingMap,
    errors,

    select: (integrationId, selected) => {
      setRoutingMap((prev) => {
        if (selected) return { ...prev, [integrationId]: {} };
        const next = { ...prev };
        delete next[integrationId];
        return next;
      });
      if (!selected) clearError(integrationId);
    },

    setField: (integrationId, field, value) => {
      setRoutingMap((prev) => ({
        ...prev,
        [integrationId]: { ...(prev[integrationId] ?? {}), [field]: value },
      }));
      clearError(integrationId);
    },

    validate: (selectedIds) => {
      const found = collectRoutingErrors(
        selectedIds,
        routingMap,
        integrations,
        t,
      );
      setErrors(found);
      return Object.keys(found).length === 0;
    },
  };
}
