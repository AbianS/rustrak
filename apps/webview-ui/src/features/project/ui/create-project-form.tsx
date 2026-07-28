'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PlatformIcon } from 'platformicons';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { createProject } from '@/features/project/api/mutations';
import {
  PROJECT_NAME_MAX_LENGTH,
  projectNameField,
  projectSlugField,
  slugifyPreview,
} from '@/features/project/model/fields';
import { applyServerFieldErrors } from '@/lib/form-errors';
import { platformLabel } from '@/lib/platforms';
import { cn } from '@/lib/utils';
import { PlatformGrid } from '@/shared/ui/platform-grid';

const createProjectFormSchema = z.object({
  platform: z.string().min(1, 'Choose a platform to continue'),
  name: projectNameField,
  slug: projectSlugField,
});

type CreateProjectFormData = z.infer<typeof createProjectFormSchema>;

interface CreateProjectFormProps {
  /**
   * Names already in use, so the auto-filled suggestion can avoid one.
   *
   * Best-effort only: it is one page of projects, not the whole set, and
   * another tab can take a name in between. The server is the real authority
   * and answers with a 409, which is surfaced as a toast.
   */
  existingNames: string[];
}

/**
 * Suggests a project name for a platform, avoiding names already taken.
 *
 * Sentry pre-fills the name field with the raw platform id, which works there
 * because `name` is unconstrained and only `slug` is de-duplicated. Rustrak
 * has a UNIQUE constraint on `projects.name`, so a second Next.js project
 * would collide on the most common path there is. Suffix instead.
 */
function suggestName(platformId: string, taken: Set<string>): string {
  if (!taken.has(platformId)) return platformId;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${platformId}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return platformId;
}

/**
 * Platform grid plus name field, submitting to `createProject`.
 *
 * `existingNames` only feeds the suggested default name; the server still has
 * the final say on collisions.
 */
export function CreateProjectForm({ existingNames }: CreateProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectFormSchema),
    defaultValues: { platform: '', name: '', slug: '' },
  });

  const platform = form.watch('platform');
  const taken = new Set(existingNames);

  // The slug is generated from the name until the user explicitly takes it
  // over with the Edit button. An explicit mode rather than a dirty-field
  // heuristic, because the field is what the button controls: read-only while
  // it mirrors the name, editable once it stops.
  const [slugMode, setSlugMode] = useState<'auto' | 'manual'>('auto');

  // In a handler rather than an effect: this is a reaction to the user typing,
  // not to a render.
  const syncSlugFromName = (name: string) => {
    if (slugMode === 'auto') {
      form.setValue('slug', slugifyPreview(name), { shouldValidate: true });
    }
  };

  const handlePlatformChange = (platformId: string) => {
    form.setValue('platform', platformId, { shouldValidate: true });

    // Only auto-fill while the user has not taken over the field, matching
    // Sentry's `hasUserModifiedProjectName` guard. `shouldDirty: false` is
    // what makes `dirtyFields.name` mean "the user typed", not "we filled it".
    if (!form.formState.dirtyFields.name) {
      const suggested = suggestName(platformId, taken);
      form.setValue('name', suggested, {
        shouldDirty: false,
        shouldValidate: true,
      });
      syncSlugFromName(suggested);
    }
  };

  const onSubmit = (data: CreateProjectFormData) => {
    startTransition(async () => {
      const result = await createProject({
        name: data.name,
        platform: data.platform,
        // Only sent when the user took the field over. An auto slug is
        // derived, and the server is allowed to de-duplicate a derived slug
        // silently. Sending the preview would turn that into a 409.
        ...(slugMode === 'manual' ? { slug: data.slug } : {}),
      });

      if (!result.success) {
        // A taken name or slug belongs on its own field, not in a toast the
        // user has to translate back into an edit. The server names the
        // offending input as data now (`fields: [{field: 'slug', code:
        // 'already_exists'}]`), so nothing here reads the message prose. The
        // helper only marks a field this form registers, so a name the form
        // does not have cannot strand it.
        const applied = applyServerFieldErrors(form, result.error, {
          labels: { name: 'Project name', slug: 'Slug' },
        });

        // The slug input is read-only while it mirrors the name, so a slug the
        // server rejected would be marked and unfixable. Hand the field over.
        if (applied.marked.includes('slug')) {
          setSlugMode('manual');
        }

        // Only when nothing landed on an input: a toast next to a red field is
        // the same sentence twice, and it outlives the fix.
        if (applied.formLevel) {
          toast.error('Failed to create project', {
            description: applied.formLevel,
          });
        }
        return;
      }

      // Straight into Client Keys: the DSN and the platform's setup snippet
      // are the only thing left to do, and that page owns them.
      router.push(`/projects/${result.data.id}/settings/client-keys`);
    });
  };

  // Rendered in two places (the aside on desktop, the fixed bar on mobile), so
  // it lives here rather than being written twice.
  const submitLabel = isPending ? (
    <>
      <Loader2 className="mr-2 size-4 animate-spin" />
      Creating...
    </>
  ) : (
    'Create Project'
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        // Bottom padding clears the fixed mobile bar, which would otherwise
        // cover the last field.
        className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:pb-0"
      >
        <FormField
          control={form.control}
          name="platform"
          render={({ field }) => (
            <FormItem className="min-w-0">
              <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Platform
              </FormLabel>
              <FormControl>
                <PlatformGrid
                  value={field.value || null}
                  onValueChange={handlePlatformChange}
                  disabled={isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <aside className="rounded-xl border bg-card p-5 lg:sticky lg:top-6">
          <div className="flex items-center gap-3 border-b pb-4">
            {platform ? (
              <>
                <PlatformIcon platform={platform} size={32} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {platformLabel(platform)}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {platform}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="size-8 shrink-0 rounded-md border border-dashed" />
                <p className="text-sm text-muted-foreground">
                  No platform selected
                </p>
              </>
            )}
          </div>

          <div className="pt-4">
            <FormField
              control={form.control}
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
                      disabled={isPending}
                      maxLength={PROJECT_NAME_MAX_LENGTH}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        syncSlugFromName(e.target.value);
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
              control={form.control}
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
                        readOnly={slugMode === 'auto'}
                        aria-readonly={slugMode === 'auto'}
                        disabled={isPending}
                        className={cn(
                          'font-mono',
                          slugMode === 'auto' &&
                            'bg-muted text-muted-foreground',
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
                      disabled={isPending}
                      aria-label={
                        slugMode === 'auto'
                          ? 'Edit slug'
                          : 'Reset slug to follow the name'
                      }
                      title={
                        slugMode === 'auto'
                          ? 'Edit slug'
                          : 'Reset slug to follow the name'
                      }
                      onClick={() => {
                        if (slugMode === 'auto') {
                          setSlugMode('manual');
                          return;
                        }
                        // Back to auto: re-derive immediately, otherwise the
                        // field would keep a stale hand-typed value until the
                        // next keystroke in the name.
                        setSlugMode('auto');
                        form.setValue(
                          'slug',
                          slugifyPreview(form.getValues('name')),
                          { shouldValidate: true },
                        );
                      }}
                      className="shrink-0"
                    >
                      {slugMode === 'auto' ? (
                        <Pencil className="size-4" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                    </Button>
                  </div>
                  {/* One line, not two: FormMessage falls back to its
                      children when the field is valid, so the hint and the
                      error occupy the same slot and the panel never reflows. */}
                  <FormMessage
                    className={cn(
                      'mt-1.5 text-xs',
                      !fieldState.error && 'text-muted-foreground',
                    )}
                  >
                    {slugMode === 'auto'
                      ? 'Generated from the name. Edit it to choose your own.'
                      : 'Yours to choose. A slug already in use is rejected.'}
                  </FormMessage>
                </FormItem>
              )}
            />
          </div>

          {/* Where a server failure that named no field of this form lands. */}
          <FormRootError className="mt-4" />

          {/* Hidden on mobile: the fixed bar below owns the action there, and
              two live submit buttons would be one too many. */}
          <Button
            type="submit"
            disabled={isPending}
            className="mt-5 hidden w-full lg:flex"
          >
            {submitLabel}
          </Button>

          <p className="mt-3 hidden text-xs text-muted-foreground lg:block">
            You will get your DSN and setup snippet next.
          </p>
        </aside>

        {/* Mobile action bar. The platform grid is tall, so a button sitting
            below it is off-screen for most of the time the user spends on this
            page. Pinning it also keeps the current selection visible while
            scrolling the list. */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            {platform ? (
              <>
                <PlatformIcon platform={platform} size={24} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {platformLabel(platform)}
                </span>
              </>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                Pick a platform
              </span>
            )}
            <Button
              type="submit"
              disabled={isPending}
              className="shrink-0"
              size="sm"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
