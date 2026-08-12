'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import type { AlertRuleFormData } from '@/features/alert/model/alert-rule-form';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/components/shadcn/form';
import { Input } from '@/shared/ui/components/shadcn/input';

/** How far one nudge of the stepper moves the cooldown, in minutes. */
const STEP = 5;

export function CooldownField({ disabled }: { disabled: boolean }) {
  const t = useTranslations('alerts');
  const { control, watch } = useFormContext<AlertRuleFormData>();
  const cooldown = watch('cooldown_minutes');

  return (
    <FormField
      control={control}
      name="cooldown_minutes"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('ruleDialog.cooldown')}
          </FormLabel>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('ruleDialog.decreaseCooldown', { count: STEP })}
              className="size-9 shrink-0"
              disabled={disabled || cooldown <= 0}
              onClick={() => field.onChange(Math.max(0, cooldown - STEP))}
            >
              <Minus className="size-3.5" />
            </Button>
            <FormControl>
              <Input
                type="number"
                min={0}
                disabled={disabled}
                className="text-center"
                {...field}
                onChange={(e) =>
                  field.onChange(parseInt(e.target.value, 10) || 0)
                }
              />
            </FormControl>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('ruleDialog.increaseCooldown', { count: STEP })}
              className="size-9 shrink-0"
              disabled={disabled}
              onClick={() => field.onChange(cooldown + STEP)}
            >
              <Plus className="size-3.5" />
            </Button>
            <span className="text-sm text-muted-foreground shrink-0">
              {t('ruleDialog.minutesUnit')}
            </span>
          </div>
          <FormDescription>
            {cooldown === 0
              ? t('ruleDialog.noCooldownLimit')
              : t('ruleDialog.cooldownLimit', { count: cooldown })}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
