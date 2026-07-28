'use client';

import { type FieldValues, type Path, useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/components/shadcn/form';
import { Input } from '@/shared/ui/components/shadcn/input';

/**
 * What the integration is called, which every provider asks for identically.
 *
 * Generic over the form shape rather than tied to one: the three schemas share
 * only `name` and `is_enabled`, and a union of them would let a caller reach
 * for a field its own provider does not have.
 */
export function NameField<T extends FieldValues & { name: string }>({
  placeholder,
  disabled,
}: {
  placeholder: string;
  disabled: boolean;
}) {
  const { control } = useFormContext<T>();

  return (
    <FormField
      control={control}
      name={'name' as Path<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Name
          </FormLabel>
          <FormControl>
            <Input placeholder={placeholder} disabled={disabled} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
