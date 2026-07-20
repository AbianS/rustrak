'use client';

import type { ProjectMember, ProjectRole, TeamMember } from '@rustrak/client';
import { Loader2, Trash2, UserPlus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { removeProjectMember, upsertProjectMember } from '@/actions/members';
import { listTeam } from '@/actions/team';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PROJECT_ROLES: { value: ProjectRole; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Admin' },
];

interface MembersSettingsProps {
  projectId: number;
  members: ProjectMember[];
  currentUserId?: number;
  canManage: boolean;
}

function roleLabel(role: ProjectRole): string {
  return PROJECT_ROLES.find((r) => r.value === role)?.label ?? role;
}

export function MembersSettings({
  projectId,
  members,
  currentUserId,
  canManage,
}: MembersSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const memberIds = new Set(members.map((m) => m.user_id));
  // Exclude users who are already members, and global admins — admins (including
  // the primary user) already have implicit access to every project, so adding
  // them as a project member is meaningless.
  const availableUsers = (team ?? []).filter(
    (user) => !memberIds.has(user.id) && user.role !== 'admin',
  );

  // Lazily load the team list (to populate the add-member dropdown) the first
  // time a manager visits this page.
  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    listTeam()
      .then((result) => {
        if (!cancelled) setTeam(result);
      })
      .catch(() => {
        // Leave team as null (not []) so a remount/refresh retries the fetch
        // instead of being stuck with an empty dropdown.
      });
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  const handleRoleChange = (member: ProjectMember, role: ProjectRole) => {
    if (role === member.role) return;
    startTransition(async () => {
      const result = await upsertProjectMember(projectId, {
        user_id: member.user_id,
        role,
      });
      if (result.success) {
        toast.success('Member updated', {
          description: `${member.email} is now ${roleLabel(role)}.`,
        });
        router.refresh();
      } else {
        toast.error('Failed to update member', { description: result.error });
      }
    });
  };

  const handleRemove = (member: ProjectMember) => {
    startTransition(async () => {
      const result = await removeProjectMember(projectId, member.user_id);
      if (result.success) {
        toast.success('Member removed');
        router.refresh();
      } else {
        toast.error('Failed to remove member', { description: result.error });
      }
    });
  };

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4 md:mb-8">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">
            Project Members
          </h1>
          <p className="mt-1 text-muted-foreground">
            {canManage
              ? 'Manage who can access this project and their roles.'
              : 'People with access to this project.'}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAddDialog(true)} className="shrink-0">
            <UserPlus className="mr-2 size-4" />
            Add Member
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Users className="mx-auto mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No members yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {canManage && <TableHead className="w-16 text-right" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const isSelf = member.user_id === currentUserId;
                return (
                  <TableRow key={member.user_id}>
                    <TableCell className="font-medium">
                      {member.email}
                      {isSelf && (
                        <span className="font-normal text-muted-foreground">
                          {' '}
                          (you)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) => {
                            if (value)
                              handleRoleChange(member, value as ProjectRole);
                          }}
                          disabled={isPending}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-28"
                            aria-label={`Change role for ${member.email}`}
                          >
                            <SelectValue>
                              {(value) => roleLabel(value as ProjectRole)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {PROJECT_ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">
                          {roleLabel(member.role)}
                        </Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(member)}
                            disabled={isPending}
                            aria-label={`Remove ${member.email}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AddMemberDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        projectId={projectId}
        availableUsers={availableUsers}
        onSuccess={() => {
          setShowAddDialog(false);
          router.refresh();
        }}
      />
    </>
  );
}

// ============================================================================
// Add Member Dialog
// ============================================================================

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  availableUsers: TeamMember[];
  onSuccess: () => void;
}

function AddMemberDialog({
  open,
  onOpenChange,
  projectId,
  availableUsers,
  onSuccess,
}: AddMemberDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ProjectRole>('viewer');

  useEffect(() => {
    if (!open) {
      setUserId('');
      setRole('viewer');
    }
  }, [open]);

  const handleAdd = () => {
    const parsedId = Number.parseInt(userId, 10);
    if (!Number.isFinite(parsedId)) return;
    startTransition(async () => {
      const result = await upsertProjectMember(projectId, {
        user_id: parsedId,
        role,
      });
      if (result.success) {
        toast.success('Member added');
        onSuccess();
      } else {
        toast.error('Failed to add member', { description: result.error });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>
            Grant a teammate access to this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              User
            </label>
            <Select
              value={userId}
              onValueChange={(value) => setUserId(value ?? '')}
              disabled={isPending || availableUsers.length === 0}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Select a user to add"
              >
                <SelectValue
                  placeholder={
                    availableUsers.length === 0
                      ? 'No users available'
                      : 'Select a user'
                  }
                >
                  {(value) =>
                    availableUsers.find((u) => String(u.id) === value)?.email ??
                    ''
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Role
            </label>
            <Select
              value={role}
              onValueChange={(value) => {
                if (value) setRole(value as ProjectRole);
              }}
              disabled={isPending}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Role for new member"
              >
                <SelectValue>
                  {(value) => roleLabel(value as ProjectRole)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PROJECT_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={isPending || !userId}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="mr-2 size-4" />
                Add
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
