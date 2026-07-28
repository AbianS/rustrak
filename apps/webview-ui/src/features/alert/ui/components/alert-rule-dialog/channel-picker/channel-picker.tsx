'use client';

import type { AlertIntegration } from '@rustrak/client';
import { useFormContext } from 'react-hook-form';
import { routingNeedsOf } from '@/features/alert/lib/routing';
import type { AlertRuleFormData } from '@/features/alert/model/alert-rule-form';
import type { ChannelRouting } from '@/features/alert/ui/hooks/use-channel-routing';
import { ChannelCard } from './channel-card';
import { ChannelRoutingFields } from './channel-routing-fields';

/**
 * Which integrations this rule sends through, and how each one is routed.
 *
 * The selection lives in the form (`selected_integration_ids` is validated
 * with the rest of it); the routing lives in `useChannelRouting`, because what
 * a channel needs depends on its provider and cannot be a fixed schema. This
 * component is where those two meet, which is why selecting a channel writes
 * to both.
 */
export function ChannelPicker({
  integrations,
  routing,
  disabled,
}: {
  integrations: AlertIntegration[];
  routing: ChannelRouting;
  disabled: boolean;
}) {
  const { watch, setValue, getValues, clearErrors, formState } =
    useFormContext<AlertRuleFormData>();
  const selectedIds = watch('selected_integration_ids');
  // Built once per render rather than scanning the array inside the map: the
  // two lists grow together, so a linear lookup per row is quadratic in the
  // number of integrations a project has configured.
  const selected = new Set(selectedIds);

  const toggle = (id: number, selected: boolean) => {
    const current = getValues('selected_integration_ids');
    if (selected) {
      setValue('selected_integration_ids', [...current, id], {
        shouldValidate: true,
      });
      clearErrors('selected_integration_ids');
    } else {
      setValue(
        'selected_integration_ids',
        current.filter((i) => i !== id),
      );
    }
    routing.select(id, selected);
  };

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
        Send To
      </p>
      <div className="space-y-2">
        {integrations.map((integration) => {
          const isSelected = selected.has(integration.id);
          const error = routing.errors[integration.id];
          const { hasRoutingFields } = routingNeedsOf(integration);

          return (
            <div key={integration.id}>
              <ChannelCard
                integration={integration}
                selected={isSelected}
                disabled={disabled}
                onSelect={(next) => toggle(integration.id, next)}
              />

              {isSelected && hasRoutingFields && (
                <ChannelRoutingFields
                  integration={integration}
                  routing={routing.routingMap[integration.id] ?? {}}
                  error={error}
                  disabled={disabled}
                  onChange={(field, value) =>
                    routing.setField(integration.id, field, value)
                  }
                />
              )}

              {/* A channel with nothing to route can still fail validation,
                  and with no block underneath it there is nowhere for that
                  message to land. */}
              {isSelected && error && !hasRoutingFields && (
                <p className="mx-3 text-xs text-destructive">{error}</p>
              )}
            </div>
          );
        })}
      </div>

      {formState.errors.selected_integration_ids && (
        <p className="text-xs text-destructive mt-1.5">
          {formState.errors.selected_integration_ids.message}
        </p>
      )}
    </div>
  );
}
