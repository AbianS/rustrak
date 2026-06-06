'use client';

import type { ProjectMember, ProjectRole, TeamMember } from '@rustrak/client';
import { Loader2, Trash2, UserPlus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { removeProjectMember, upsertProjectMember } from '@/actions/members';
import { listTeam } from '@/actions/team';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const PROJECT_ROLES: { value: ProjectRole; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Admin' },
];

interface ProjectMembersDialogProps {
  projectId: number;
  members: ProjectMember[];
  currentUserId?: number;
  canManage: boolean;
}

function roleLabel(role: ProjectRole): string {
  return PROJECT_ROLES.find((r) => r.value === role)?.label ?? role;
}

export function ProjectMembersDialog({
  projectId,
  members,
  currentUserId,
  canManage,
}: ProjectMembersDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [addUserId, setAddUserId] = useState<string>('');
  const [addRole, setAddRole] = useState<ProjectRole>('viewer');

  const memberIds = new Set(members.map((m) => m.user_id));
  // Exclude users who are already members, and global admins — admins (including
  // the primary user) already have implicit access to every project, so adding
  // them as a project member is meaningless.
  const availableUsers = (team ?? []).filter(
    (user) => !memberIds.has(user.id) && user.role !== 'admin',
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    // Lazily load the team list (to populate the add-member dropdown) when
    // a manager opens the dialog.
    if (next && canManage && team === null) {
      startTransition(async () => {
        try {
          const result = await listTeam();
          setTeam(result);
        } catch {
          // Non-fatal: the add-member dropdown just stays empty.
          setTeam([]);
        }
      });
    }
  };

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

  const handleAdd = () => {
    const userId = Number.parseInt(addUserId, 10);
    if (!Number.isFinite(userId)) return;
    startTransition(async () => {
      const result = await upsertProjectMember(projectId, {
        user_id: userId,
        role: addRole,
      });
      if (result.success) {
        toast.success('Member added');
        setAddUserId('');
        setAddRole('viewer');
        router.refresh();
      } else {
        toast.error('Failed to add member', { description: result.error });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="icon" title="Project Members" />
        }
      >
        <Users className="size-4" />
        <span className="sr-only">Project members</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl flex flex-col max-h-[90svh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Project Members</DialogTitle>
          <DialogDescription>
            {canManage
              ? 'Manage who can access this project and their roles.'
              : 'People with access to this project.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto min-h-0 pr-1">
          {/* Members list */}
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No members yet</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => {
                const isSelf = member.user_id === currentUserId;
                return (
                  <li
                    key={member.user_id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium truncate">
                        {member.email}
                        {isSelf && (
                          <span className="text-muted-foreground"> (you)</span>
                        )}
                      </p>
                      {!canManage && (
                        <Badge variant="secondary">
                          {roleLabel(member.role)}
                        </Badge>
                      )}
                    </div>
                    {canManage ? (
                      <div className="flex items-center gap-2 shrink-0">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(member)}
                          disabled={isPending}
                          className="text-destructive hover:text-destructive"
                          aria-label={`Remove ${member.email}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="shrink-0">
                        {roleLabel(member.role)}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add member */}
          {canManage && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Add member
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={addUserId}
                    onValueChange={(value) => setAddUserId(value ?? '')}
                    disabled={isPending || availableUsers.length === 0}
                  >
                    <SelectTrigger
                      className="flex-1"
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
                          team?.find((u) => String(u.id) === value)?.email ?? ''
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
                  <Select
                    value={addRole}
                    onValueChange={(value) => {
                      if (value) setAddRole(value as ProjectRole);
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger
                      size="sm"
                      className="sm:w-28"
                      aria-label="Role for new member"
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
                  <Button
                    onClick={handleAdd}
                    disabled={isPending || !addUserId}
                    className="shrink-0"
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="mr-2 size-4" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
