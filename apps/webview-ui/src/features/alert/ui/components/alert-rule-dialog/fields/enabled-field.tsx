'use client';

import { useFormContext } from 'react-hook-form';
import type { AlertRuleFormData } from '@/features/alert/model/alert-rule-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/shared/ui/components/shadcn/form';
import { Switch } from '@/shared/ui/components/shadcn/switch';

export function EnabledField({ disabled }: { disabled: boolean }) {
  const { control } = useFormContext<AlertRuleFormData>();

  return (
    <FormField
      control={control}
      name="is_enabled"
      render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <FormLabel className="text-sm font-medium">Enable rule</FormLabel>
            <FormDescription className="text-xs">
              Start sending alerts immediately after saving
            </FormDescription>
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
