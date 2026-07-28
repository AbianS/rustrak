'use client';

import { useFormContext } from 'react-hook-form';
import type { AlertRuleFormData } from '@/features/alert/model/alert-rule-form';
import type { alertTypes } from '@/features/alert/model/alert-types';
import { AlertTypeIcon } from '@/features/alert/ui/components/alert-type-icon';
import { cn } from '@/shared/lib/utils';
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/components/shadcn/form';

/**
 * The trigger, as three cards rather than a select.
 *
 * `locked` is passed when editing: a rule's trigger cannot change after
 * creation, because the server keys a project's rules on it and a rule that
 * switched trigger would collide with whatever already covers the new one.
 */
export function TriggerField({
  types,
  disabled,
  locked,
}: {
  types: typeof alertTypes;
  disabled: boolean;
  locked: boolean;
}) {
  const { control, setValue, watch } = useFormContext<AlertRuleFormData>();
  const selected = watch('alert_type');
  const inert = disabled || locked;

  return (
    <FormField
      control={control}
      name="alert_type"
      render={() => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Trigger
          </FormLabel>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {types.map((t) => {
              const isSelected = selected === t.type;
              return (
                <button
                  key={t.type}
                  type="button"
                  disabled={inert}
                  onClick={() =>
                    setValue('alert_type', t.type, { shouldValidate: true })
                  }
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all',
                    'hover:border-primary/50 hover:bg-accent/50',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border bg-card',
                    inert && 'opacity-60 cursor-not-allowed',
                  )}
                >
                  <AlertTypeIcon
                    type={t.type}
                    className={cn(
                      'size-4',
                      isSelected ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <div>
                    <p
                      className={cn(
                        'text-xs font-semibold leading-none',
                        isSelected ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {t.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      {t.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
