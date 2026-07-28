'use client';

import { Loader2 } from 'lucide-react';
import type { Path, UseFormReturn } from 'react-hook-form';
import { SettingRow } from '@/shared/ui/components/setting-row';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/shared/ui/components/shadcn/form';
import { Input } from '@/shared/ui/components/shadcn/input';
import type { GeneralSettingsFormData } from './general-settings-form';

/**
 * One settings field that saves on its own.
 *
 * Each row commits independently rather than the page having a single Save,
 * so a user who renamed the project and then thought better of the slug is
 * not forced to submit both or neither.
 *
 * The button stays disabled until the value actually differs from what is
 * stored: a Save that does nothing still costs a round trip and a toast
 * claiming something changed.
 */
export function SavableRow({
  form,
  name,
  title,
  description,
  placeholder,
  className,
  isPending,
  hasChanges,
  onSave,
  onEdit,
}: {
  form: UseFormReturn<GeneralSettingsFormData>;
  name: Path<GeneralSettingsFormData>;
  title: string;
  description: string;
  placeholder: string;
  className?: string;
  isPending: boolean;
  hasChanges: boolean;
  onSave: () => void;
  onEdit: () => void;
}) {
  const id = `project-${name}`;

  return (
    <SettingRow title={title} description={description} htmlFor={id}>
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-2">
              <FormControl>
                <Input
                  id={id}
                  placeholder={placeholder}
                  className={className}
                  disabled={isPending}
                  {...field}
                  onChange={(event) => {
                    field.onChange(event);
                    onEdit();
                  }}
                />
              </FormControl>
              <Button
                type="button"
                onClick={onSave}
                disabled={isPending || !hasChanges || !field.value?.trim()}
                size="sm"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </SettingRow>
  );
}
