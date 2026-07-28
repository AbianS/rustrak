'use client';

import { Pencil, RotateCcw } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import {
  PROJECT_NAME_MAX_LENGTH,
  slugifyPreview,
} from '@/features/project/model/fields';
import type { ProjectSlug } from '@/features/project/ui/hooks/use-project-slug';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/components/shadcn/form';
import { Input } from '@/shared/ui/components/shadcn/input';
import type { CreateProjectFormData } from './create-project-form';

/**
 * The name, and the slug that follows it until the user says otherwise.
 *
 * These two are one control, not two: typing a name rewrites the slug, and the
 * pencil is what breaks that link. The state behind it lives in
 * `useProjectSlug` because the submit and the server-error path need the same
 * answer, so this component renders it rather than owning it.
 */
export function IdentityFields({
  slug,
  disabled,
}: {
  slug: ProjectSlug;
  disabled: boolean;
}) {
  const { control } = useFormContext<CreateProjectFormData>();

  const toggleLabel = slug.isManual
    ? 'Reset slug to follow the name'
    : 'Edit slug';

  return (
    <>
      <div className="pt-4">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Project name
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="my-application"
                  autoComplete="off"
                  disabled={disabled}
                  maxLength={PROJECT_NAME_MAX_LENGTH}
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    slug.syncFromName(e.target.value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="pt-4">
        <FormField
          control={control}
          name="slug"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Slug
              </FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    placeholder="my-application"
                    autoComplete="off"
                    readOnly={!slug.isManual}
                    aria-readonly={!slug.isManual}
                    disabled={disabled}
                    className={cn(
                      'font-mono',
                      !slug.isManual && 'bg-muted text-muted-foreground',
                    )}
                    {...field}
                    onChange={(e) =>
                      field.onChange(slugifyPreview(e.target.value))
                    }
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  aria-label={toggleLabel}
                  title={toggleLabel}
                  onClick={slug.toggle}
                  className="shrink-0"
                >
                  {slug.isManual ? (
                    <RotateCcw className="size-4" />
                  ) : (
                    <Pencil className="size-4" />
                  )}
                </Button>
              </div>
              {/* One line, not two: FormMessage falls back to its children
                  when the field is valid, so the hint and the error occupy
                  the same slot and the panel never reflows. */}
              <FormMessage
                className={cn(
                  'mt-1.5 text-xs',
                  !fieldState.error && 'text-muted-foreground',
                )}
              >
                {slug.isManual
                  ? 'Yours to choose. A slug already in use is rejected.'
                  : 'Generated from the name. Edit it to choose your own.'}
              </FormMessage>
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
