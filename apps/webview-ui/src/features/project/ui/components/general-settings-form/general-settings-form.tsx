'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Project } from '@rustrak/client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { deleteProject, updateProject } from '@/features/project/api/mutations';
import {
  projectNameField,
  projectSlugField,
} from '@/features/project/model/fields';
import { describeError } from '@/shared/lib/error-copy';
import {
  applyServerFieldErrors,
  SERVER_ERROR_PATH,
} from '@/shared/lib/form-errors';
import { PlatformPicker } from '@/shared/ui/components/platform-picker';
import { SettingRow, SettingSection } from '@/shared/ui/components/setting-row';
import { Form, FormRootError } from '@/shared/ui/components/shadcn/form';
import { DangerZone } from './danger-zone';
import { SavableRow } from './savable-row';

/**
 * The same rules the create form uses, imported rather than restated.
 *
 * This form had none at all before: it was raw `useState`, so a one-character
 * name reached the server and came back as a toast, and a server-named field
 * had no input to attach itself to.
 */
const generalSettingsSchema = z.object({
  name: projectNameField,
  slug: projectSlugField,
});

export type GeneralSettingsFormData = z.infer<typeof generalSettingsSchema>;

interface GeneralSettingsFormProps {
  project: Project;
}

const FIELD_LABELS = { name: 'Project name', slug: 'Slug' };

export function GeneralSettingsForm({ project }: GeneralSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<GeneralSettingsFormData>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: { name: project.name, slug: project.slug },
  });

  const name = form.watch('name');
  const slug = form.watch('slug');
  const hasNameChanges = name !== project.name;
  const hasSlugChanges = slug !== project.slug;

  const handleSaveName = () => {
    // Each row saves one field, so validate that field alone. Submitting the
    // whole form would mark the slug red for a name the user never touched.
    void form.trigger('name').then((valid) => {
      if (!valid || !hasNameChanges) return;

      startTransition(async () => {
        const trimmed = form.getValues('name').trim();
        const result = await updateProject(project.id, { name: trimmed });

        if (!result.success) {
          reportFailure(result.error, 'Failed to update project');
          return;
        }

        // Keep the field on the value that was actually persisted, otherwise
        // stray whitespace leaves the Save button looking permanently dirty.
        form.setValue('name', trimmed);
        clearFailure();
        toast.success('Project updated');
        router.refresh();
      });
    });
  };

  const handleSaveSlug = () => {
    void form.trigger('slug').then((valid) => {
      if (!valid || !hasSlugChanges) return;

      startTransition(async () => {
        const result = await updateProject(project.id, {
          slug: form.getValues('slug').trim(),
        });

        if (!result.success) {
          reportFailure(result.error, 'Failed to update slug');
          return;
        }

        // The server slugifies the input, so echo back what it actually
        // stored rather than the raw text: typing "My API" must leave the
        // field showing "my-api", not a value that was never persisted.
        form.setValue('slug', result.data.slug);
        clearFailure();
        toast.success('Slug updated');
        router.refresh();
      });
    });
  };

  const handlePlatformChange = (platform: string) => {
    if (!platform || platform === project.platform) return;

    startTransition(async () => {
      const result = await updateProject(project.id, { platform });

      if (!result.success) {
        // The picker is not a registered field, so this one has nowhere to go
        // but the form-level slot; `reportFailure` puts it there.
        reportFailure(result.error, 'Failed to update platform');
        return;
      }

      clearFailure();
      toast.success('Platform updated');
      router.refresh();
    });
  };

  const handleRemoveProject = async () => {
    const result = await deleteProject(project.id);

    if (!result.success) {
      // Toast only, deliberately. The Danger Zone sits outside the `<Form>`
      // wrapper, so a form-level message raised here renders up in Project
      // Details, nowhere near the button that was pressed.
      toast.error('Failed to delete project', {
        description: describeError(result.error),
      });
      return;
    }

    toast.success('Project deleted');
    router.push('/projects');
  };

  /**
   * Put a failure where the user can act on it: on the input the server named,
   * or in the form-level slot plus a toast when it named nothing this form has.
   */
  function reportFailure(
    error: Parameters<typeof applyServerFieldErrors>[1],
    title: string,
  ) {
    const applied = applyServerFieldErrors(form, error, {
      labels: FIELD_LABELS,
    });

    if (applied.formLevel) {
      toast.error(title, { description: applied.formLevel });
    }
  }

  /**
   * Drop the form-level message once something has succeeded.
   *
   * `applyServerFieldErrors` clears this slot on its way in, so a *second*
   * failure replaces the first. A success calls nothing, and react-hook-form
   * only clears `root` inside `handleSubmit`, which this form never uses. So
   * without this the red "Failed to update platform" from an outage sits under
   * the section forever, next to a toast saying the platform was updated.
   */
  function clearFailure() {
    form.clearErrors(SERVER_ERROR_PATH);
  }

  /**
   * Drop a server-supplied error the moment the user edits the value it was
   * about.
   *
   * Each row saves on its own button rather than through `handleSubmit`, so
   * `formState.isSubmitted` never turns true and react-hook-form's
   * `reValidateMode: 'onChange'` never engages. Without this, "Project name is
   * already taken." stays under an input the user has already corrected, and
   * the only way to find out it is stale is to press Save again.
   */
  function clearServerError(field: 'name' | 'slug') {
    if (form.getFieldState(field).error?.type === 'server') {
      form.clearErrors(field);
    }
  }

  return (
    <div className="max-w-3xl">
      <Form {...form}>
        <SettingSection title="Project Details">
          <SavableRow
            form={form}
            name="name"
            title="Name"
            description="How this project appears across the dashboard."
            placeholder="Project name"
            isPending={isPending}
            hasChanges={hasNameChanges}
            onSave={handleSaveName}
            onEdit={() => clearServerError('name')}
          />

          <SavableRow
            form={form}
            name="slug"
            title="Slug"
            description="Short identifier for this project. Your DSN and dashboard links use the numeric project ID, so renaming this will not break anything already sending events."
            placeholder="project-slug"
            className="font-mono"
            isPending={isPending}
            hasChanges={hasSlugChanges}
            onSave={handleSaveSlug}
            onEdit={() => clearServerError('slug')}
          />

          <SettingRow
            title="Platform"
            description="Detected from the first event received. Change it if the detected value is wrong or too broad."
          >
            <PlatformPicker
              value={project.platform}
              onValueChange={handlePlatformChange}
              disabled={isPending}
            />
          </SettingRow>

          {/* Where a failure that named no field of this form lands. */}
          <FormRootError />
        </SettingSection>
      </Form>

      <DangerZone project={project} onRemove={handleRemoveProject} />
    </div>
  );
}
