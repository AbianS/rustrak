'use client';

import type { ProjectMember, ProjectRole } from '@rustrak/client';
import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { PROJECT_ROLES, roleLabel } from '@/features/user/model/roles';
import { DataTable } from '@/shared/ui/components/data-table/data-table';
import {
  createAppColumnHelper,
  useAppTable,
} from '@/shared/ui/components/data-table/use-app-table';
import { Badge } from '@/shared/ui/components/shadcn/badge';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/components/shadcn/select';

const helper = createAppColumnHelper<ProjectMember>();

/**
 * Who can see this project, and at what level.
 *
 * The actions column exists only when the reader can manage members, which is
 * a column that is absent rather than a column that is disabled: an empty
 * header over a column of nothing is worse than one fewer column.
 */
export function ProjectMembersTable({
  members,
  currentUserId,
  canManage,
  disabled,
  onRoleChange,
  onRemove,
}: {
  members: ProjectMember[];
  currentUserId?: number;
  canManage: boolean;
  disabled: boolean;
  onRoleChange: (member: ProjectMember, role: ProjectRole) => void;
  onRemove: (member: ProjectMember) => void;
}) {
  const columns = useMemo(() => {
    const email = helper.accessor('email', {
      header: 'Email',
      minSize: 200,
      meta: { grow: true },
      cell: ({ row }) => (
        <span className="truncate font-medium">
          {row.original.email}
          {row.original.user_id === currentUserId && (
            <span className="font-normal text-muted-foreground"> (you)</span>
          )}
        </span>
      ),
    });

    const role = helper.accessor('role', {
      header: 'Role',
      size: 160,
      minSize: 120,
      cell: ({ row }) =>
        canManage ? (
          <Select
            value={row.original.role}
            onValueChange={(value) => {
              if (value) onRoleChange(row.original, value as ProjectRole);
            }}
            disabled={disabled}
          >
            <SelectTrigger
              size="sm"
              className="w-28"
              aria-label={`Change role for ${row.original.email}`}
            >
              <SelectValue>
                {(value) => roleLabel(value as ProjectRole)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PROJECT_ROLES.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="secondary">{roleLabel(row.original.role)}</Badge>
        ),
    });

    if (!canManage) return helper.columns([email, role]);

    return helper.columns([
      email,
      role,
      helper.display({
        id: 'actions',
        size: 64,
        minSize: 64,
        maxSize: 64,
        meta: { align: 'end' },
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(row.original)}
              disabled={disabled}
              aria-label={`Remove ${row.original.email}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      }),
    ]);
  }, [canManage, currentUserId, disabled, onRoleChange, onRemove]);

  const table = useAppTable({
    data: members,
    columns,
    getRowId: (member) => String(member.user_id),
    rowCount: members.length,
  });

  return <DataTable table={table} isPending={disabled} />;
}
