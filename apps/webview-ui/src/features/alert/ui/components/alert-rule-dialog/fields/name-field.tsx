'use client';

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
  const { control } = useFormContext<AlertRuleFormData>();

  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Rule Name
          </FormLabel>
          <FormControl>
            <Input
              placeholder="e.g., Notify team on new issues"
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
