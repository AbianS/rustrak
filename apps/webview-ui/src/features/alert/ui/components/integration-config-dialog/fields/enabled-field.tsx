'use client';

import { type FieldValues, type Path, useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/shared/ui/components/shadcn/form';
import { Switch } from '@/shared/ui/components/shadcn/switch';

/** Whether alerts go out on this integration. Identical for every provider. */
export function EnabledField<T extends FieldValues & { is_enabled: boolean }>({
  disabled,
}: {
  disabled: boolean;
}) {
  const { control } = useFormContext<T>();

  return (
    <FormField
      control={control}
      name={'is_enabled' as Path<T>}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <FormLabel className="text-sm font-medium">Enabled</FormLabel>
            <FormDescription className="text-xs">
              Receive alerts on this integration
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
