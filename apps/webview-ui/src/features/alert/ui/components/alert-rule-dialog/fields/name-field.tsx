'use client';

import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import type { AlertRuleFormData } from '@/features/alert/model/alert-rule-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/components/shadcn/form';
import { Input } from '@/shared/ui/components/shadcn/input';

export function NameField({ disabled }: { disabled: boolean }) {
  const t = useTranslations('alerts');
  const { control } = useFormContext<AlertRuleFormData>();

  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('ruleDialog.name')}
          </FormLabel>
          <FormControl>
            <Input
              placeholder={t('ruleDialog.namePlaceholder')}
              autoComplete="off"
              disabled={disabled}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
