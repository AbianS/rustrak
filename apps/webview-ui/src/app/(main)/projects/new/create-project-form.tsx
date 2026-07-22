'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PlatformIcon } from 'platformicons';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { createProject } from '@/actions/projects';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { platformLabel } from '@/lib/platforms';
import { PlatformGrid } from './platform-grid';

const PROJECT_NAME_MIN_LENGTH = 2;
const PROJECT_NAME_MAX_LENGTH = 100;

const createProjectFormSchema = z.object({
  platform: z.string().min(1, 'Choose a platform to continue'),
  name: z
    .string()
    .trim()
    .min(
      PROJECT_NAME_MIN_LENGTH,
      `Name must be at least ${PROJECT_NAME_MIN_LENGTH} characters`,
    )
    .max(
      PROJECT_NAME_MAX_LENGTH,
      `Name must be at most ${PROJECT_NAME_MAX_LENGTH} characters`,
    ),
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
    defaultValues: { platform: '', name: '' },
  });

  const platform = form.watch('platform');
  const taken = new Set(existingNames);

  const handlePlatformChange = (platformId: string) => {
    form.setValue('platform', platformId, { shouldValidate: true });

    // Only auto-fill while the user has not taken over the field, matching
    // Sentry's `hasUserModifiedProjectName` guard. `shouldDirty: false` is
    // what makes `dirtyFields.name` mean "the user typed", not "we filled it".
    if (!form.formState.dirtyFields.name) {
      form.setValue('name', suggestName(platformId, taken), {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  };

  const onSubmit = (data: CreateProjectFormData) => {
    startTransition(async () => {
      try {
        const project = await createProject({
          name: data.name,
          platform: data.platform,
        });
        // Straight into Client Keys: the DSN and the platform's setup snippet
        // are the only thing left to do, and that page owns them.
        router.push(`/projects/${project.id}/settings/client-keys`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create project';
        toast.error('Failed to create project', { description: message });
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" disabled={isPending} className="mt-5 w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </Button>

          <p className="mt-3 text-xs text-muted-foreground">
            You will get your DSN and setup snippet next.
          </p>
        </aside>
      </form>
    </Form>
  );
}
