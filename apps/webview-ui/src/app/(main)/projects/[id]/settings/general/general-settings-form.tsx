'use client';

import type { Project } from '@rustrak/client';
import { Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteProject, updateProject } from '@/actions/projects';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingRow, SettingSection } from '../setting-row';
import { PlatformPicker } from './platform-picker';

interface GeneralSettingsFormProps {
  project: Project;
}

export function GeneralSettingsForm({ project }: GeneralSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const hasNameChanges = name !== project.name;
  const hasSlugChanges = slug !== project.slug;

  const handleSaveName = () => {
    if (!hasNameChanges || !name.trim()) return;

    startTransition(async () => {
      try {
        const trimmed = name.trim();
        await updateProject(project.id, { name: trimmed });
        // Keep local state on the value that was actually persisted, otherwise
        // stray whitespace leaves the Save button looking permanently dirty.
        setName(trimmed);
        toast.success('Project updated');
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update project';
        toast.error('Failed to update project', { description: message });
      }
    });
  };

  const handleSaveSlug = () => {
    if (!hasSlugChanges || !slug.trim()) return;

    startTransition(async () => {
      try {
        const updated = await updateProject(project.id, { slug: slug.trim() });
        // The server slugifies the input, so echo back what it actually
        // stored rather than the raw text: typing "My API" must leave the
        // field showing "my-api", not a value that was never persisted.
        setSlug(updated.slug);
        toast.success('Slug updated');
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update slug';
        toast.error('Failed to update slug', { description: message });
      }
    });
  };

  const handlePlatformChange = (platform: string) => {
    if (!platform || platform === project.platform) return;

    startTransition(async () => {
      try {
        await updateProject(project.id, { platform });
        toast.success('Platform updated');
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update platform';
        toast.error('Failed to update platform', { description: message });
      }
    });
  };

  const handleRemoveProject = () => {
    startTransition(async () => {
      try {
        await deleteProject(project.id);
        toast.success('Project deleted');
        router.push('/projects');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete project';
        toast.error('Failed to delete project', { description: message });
        setIsDeleteOpen(false);
      }
    });
  };

  return (
    <div className="max-w-3xl">
      <SettingSection title="Project Details">
        <SettingRow
          title="Name"
          description="How this project appears across the dashboard."
          htmlFor="project-name"
        >
          <div className="flex items-center gap-2">
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              disabled={isPending}
            />
            <Button
              onClick={handleSaveName}
              disabled={isPending || !hasNameChanges || !name.trim()}
              size="sm"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </SettingRow>

        <SettingRow
          title="Slug"
          description="Short identifier for this project. Your DSN and dashboard links use the numeric project ID, so renaming this will not break anything already sending events."
          htmlFor="project-slug"
        >
          <div className="flex items-center gap-2">
            <Input
              id="project-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="project-slug"
              disabled={isPending}
            />
            <Button
              onClick={handleSaveSlug}
              disabled={isPending || !hasSlugChanges || !slug.trim()}
              size="sm"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </SettingRow>

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
      </SettingSection>

      <SettingSection title="Danger Zone" destructive>
        <SettingRow
          title="Remove Project"
          description="Permanently deletes this project and all of its issues and events. This cannot be undone."
        >
          <Button
            variant="destructive"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            <Trash2 className="mr-2 size-4" />
            Remove Project
          </Button>
        </SettingRow>
      </SettingSection>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{project.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this project and all associated
              issues and events. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveProject}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
