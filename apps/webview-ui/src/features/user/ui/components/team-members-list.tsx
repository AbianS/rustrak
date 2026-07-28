'use client';

import type { GlobalRole, TeamMember } from '@rustrak/client';
import { format } from 'date-fns';
import { Loader2, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  removeTeamMember,
  updateUserRole,
} from '@/features/user/api/mutations';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/components/shadcn/alert-dialog';
import { Badge } from '@/shared/ui/components/shadcn/badge';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/components/shadcn/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/components/shadcn/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/components/shadcn/table';

interface TeamMembersListProps {
  members: TeamMember[];
  currentUserId: number;
}

function RoleBadge({ role }: { role: GlobalRole }) {
  return (
    <Badge variant={role === 'admin' ? 'default' : 'secondary'}>
      {role === 'admin' ? 'Admin' : 'Member'}
    </Badge>
  );
}

function RoleSelect({
  member,
  disabled,
  onChange,
}: {
  member: TeamMember;
  disabled: boolean;
  onChange: (role: GlobalRole) => void;
}) {
  return (
    <Select
      value={member.role}
      onValueChange={(value) => {
        if (value && value !== member.role) {
          onChange(value as GlobalRole);
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        className="w-32"
        aria-label={`Change role for ${member.email}`}
      >
        <SelectValue>
          {(value) => (value === 'admin' ? 'Admin' : 'Member')}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function TeamMembersList({
  members,
  currentUserId,
}: TeamMembersListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

  const handleRoleChange = (member: TeamMember, role: GlobalRole) => {
    startTransition(async () => {
      const result = await updateUserRole(member.id, role);
      if (result.success) {
        toast.success('Role updated', {
          description: `${member.email} is now ${role === 'admin' ? 'an admin' : 'a member'}.`,
        });
        router.refresh();
      } else {
        // `error.message` rather than copy built from `error.fields`: the
        // server does name `role` here, but there is no react-hook-form on
        // this table to bind that to, and its own sentence ("Cannot demote
        // the last admin") is far more use in a toast than "Role is not
        // valid." would be.
        toast.error('Failed to update role', {
          description: result.error.message,
        });
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!memberToDelete) return;
    const member = memberToDelete;
    startTransition(async () => {
      const result = await removeTeamMember(member.id);
      if (result.success) {
        toast.success('Member removed', { description: member.email });
        setMemberToDelete(null);
        router.refresh();
      } else {
        toast.error('Failed to remove member', {
          description: result.error.message,
        });
      }
    });
  };

  if (members.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="size-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No team members yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          People with access to this Rustrak instance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mobile: card list */}
        <div className="md:hidden space-y-3">
          {members.map((member) => {
            const isSelf = member.id === currentUserId;
            const isPrimary = member.is_primary === true;
            const locked = isSelf || isPrimary;
            return (
              <div key={member.id} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium truncate">
                      {member.email}
                      {isSelf && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.is_active ? 'Active' : 'Inactive'}
                      {' · '}
                      {member.last_login
                        ? `Last login ${format(new Date(member.last_login), 'MMM d, yyyy')}`
                        : 'Never logged in'}
                    </p>
                  </div>
                  <RoleBadge role={member.role} />
                </div>
                <div className="flex items-center gap-2">
                  <RoleSelect
                    member={member}
                    disabled={isPending || locked}
                    onChange={(role) => handleRoleChange(member, role)}
                  />
                  {!locked && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => setMemberToDelete(member)}
                      disabled={isPending}
                      aria-label={`Remove ${member.email}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: table */}
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="w-36">Change Role</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              const isPrimary = member.is_primary === true;
              const locked = isSelf || isPrimary;
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {member.email}
                      {isSelf && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell>
                    {member.is_active ? (
                      <span className="text-sm">Active</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.last_login ? (
                      <span className="text-sm">
                        {format(new Date(member.last_login), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Never
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RoleSelect
                      member={member}
                      disabled={isPending || locked}
                      onChange={(role) => handleRoleChange(member, role)}
                    />
                  </TableCell>
                  <TableCell>
                    {!locked && (
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => setMemberToDelete(member)}
                        disabled={isPending}
                        aria-label={`Remove ${member.email}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <AlertDialog
        open={memberToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove "{memberToDelete?.email}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the user and their access to all
              projects. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
