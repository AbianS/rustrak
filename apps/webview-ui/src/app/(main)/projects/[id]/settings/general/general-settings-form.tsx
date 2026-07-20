'use client';

import type { Project } from '@rustrak/client';
import { Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PlatformIcon } from 'platformicons';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { platformLabel, VALID_PLATFORMS } from '@/lib/platforms';

interface GeneralSettingsFormProps {
  project: Project;
}

export function GeneralSettingsForm({ project }: GeneralSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(project.name);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const hasNameChanges = name !== project.name;

  const handleSaveName = () => {
    if (!hasNameChanges || !name.trim()) return;

    startTransition(async () => {
      try {
        await updateProject(project.id, { name: name.trim() });
        toast.success('Project updated');
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update project';
        toast.error('Failed to update project', { description: message });
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
    <div className="space-y-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Project Name
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Label htmlFor="project-name" className="sr-only">
              Project name
            </Label>
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
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Platform
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={project.platform ?? undefined}
            onValueChange={(value) => value && handlePlatformChange(value)}
            disabled={isPending}
          >
            <SelectTrigger className="w-full sm:w-72" aria-label="Platform">
              <SelectValue placeholder="Select a platform">
                {(value) => (
                  <span className="flex items-center gap-2">
                    <PlatformIcon platform={value} size={16} />
                    {platformLabel(value)}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VALID_PLATFORMS.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  <span className="flex items-center gap-2">
                    <PlatformIcon platform={platform} size={16} />
                    {platformLabel(platform)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-muted-foreground">
            Auto-detected from the first ingested event. You can override it
            manually here.
          </p>
        </CardContent>
      </Card>

      <Card size="sm" className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-destructive">
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Remove Project</p>
              <p className="text-xs text-muted-foreground">
                Permanently deletes this project and all its issues and events.
                This cannot be undone.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setIsDeleteOpen(true)}
              disabled={isPending}
              className="shrink-0"
            >
              <Trash2 className="mr-2 size-4" />
              Remove Project
            </Button>
          </div>
        </CardContent>
      </Card>

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
