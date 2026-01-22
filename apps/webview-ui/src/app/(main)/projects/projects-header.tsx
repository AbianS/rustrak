'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createProject } from '@/actions/projects';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PROJECT_NAME_MIN_LENGTH = 2;
const PROJECT_NAME_MAX_LENGTH = 100;

export function ProjectsHeader() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const trimmedName = newProjectName.trim();
  const isValidLength =
    trimmedName.length >= PROJECT_NAME_MIN_LENGTH &&
    trimmedName.length <= PROJECT_NAME_MAX_LENGTH;

  const handleNameChange = (value: string) => {
    setNewProjectName(value);
    setValidationError(null);

    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length < PROJECT_NAME_MIN_LENGTH) {
      setValidationError(
        `Name must be at least ${PROJECT_NAME_MIN_LENGTH} characters`,
      );
    } else if (trimmed.length > PROJECT_NAME_MAX_LENGTH) {
      setValidationError(
        `Name must be at most ${PROJECT_NAME_MAX_LENGTH} characters`,
      );
    }
  };

  const handleCreate = () => {
    if (!trimmedName || !isValidLength) return;

    startTransition(async () => {
      try {
        await createProject({ name: trimmedName });
        toast.success('Project created', {
          description: `"${trimmedName}" has been created successfully.`,
        });
        setNewProjectName('');
        setValidationError(null);
        setIsCreateOpen(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create project';
        toast.error('Failed to create project', { description: message });
      }
    });
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Projects</h1>
        <p className="text-muted-foreground mt-1">
          Manage your error tracking projects
        </p>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 size-4" />
            New Project
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Create a new project to start tracking errors.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="My Application"
                value={newProjectName}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                maxLength={PROJECT_NAME_MAX_LENGTH + 10}
                aria-invalid={!!validationError}
                aria-describedby={validationError ? 'name-error' : undefined}
              />
              {validationError && (
                <p id="name-error" className="text-sm text-destructive">
                  {validationError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {trimmedName.length}/{PROJECT_NAME_MAX_LENGTH} characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending || !trimmedName || !isValidLength}
            >
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
