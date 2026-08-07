'use client';

import type { TeamMember } from '@rustrak/client';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { DataTable } from '@/shared/ui/components/data-table/data-table';
import {
  createAppColumnHelper,
  useAppTable,
} from '@/shared/ui/components/data-table/use-app-table';
import { Button } from '@/shared/ui/components/shadcn/button';

const helper = createAppColumnHelper<TeamMember>();

/**
 * The instance's people, as a table.
 *
 * The phone layout stays a list of cards in `TeamMembersList`; six columns do
 * not survive being narrowed to a phone, and the card is the better answer
 * there rather than a table scrolled sideways.
 *
 * "Locked" is the member the reader is, and the primary account. Neither can
 * have their role changed or be removed, and the table draws that as controls
 * that are absent or disabled rather than as a row that silently fails.
 */
export function TeamMembersTable({
  members,
  currentUserId,
  disabled,
  renderRoleBadge,
  renderRoleSelect,
  onRemove,
}: {
  members: TeamMember[];
  currentUserId?: number;
  disabled: boolean;
  renderRoleBadge: (role: TeamMember['role']) => ReactNode;
  renderRoleSelect: (member: TeamMember, locked: boolean) => ReactNode;
  onRemove: (member: TeamMember) => void;
}) {
  const isLocked = (member: TeamMember) =>
    member.id === currentUserId || member.is_primary === true;

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('email', {
          header: 'Email',
          minSize: 200,
          meta: { grow: true },
          cell: ({ row }) => (
            <span className="truncate text-sm font-medium">
              {row.original.email}
              {row.original.id === currentUserId && (
                <span className="text-muted-foreground"> (you)</span>
              )}
            </span>
          ),
        }),
        helper.accessor('role', {
          header: 'Role',
          size: 120,
          minSize: 90,
          cell: ({ getValue }) => renderRoleBadge(getValue()),
        }),
        helper.accessor('is_active', {
          id: 'status',
          header: 'Status',
          size: 100,
          minSize: 80,
          cell: ({ getValue }) =>
            getValue() ? (
              <span className="text-sm">Active</span>
            ) : (
              <span className="text-sm text-muted-foreground">Inactive</span>
            ),
        }),
        helper.accessor('last_login', {
          header: 'Last login',
          size: 140,
          minSize: 110,
          cell: ({ getValue }) => {
            const lastLogin = getValue();
            return lastLogin ? (
              <span className="text-sm whitespace-nowrap">
                {format(new Date(lastLogin), 'MMM d, yyyy')}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Never</span>
            );
          },
        }),
        helper.display({
          id: 'change_role',
          header: 'Change role',
          size: 150,
          minSize: 130,
          cell: ({ row }) =>
            renderRoleSelect(row.original, isLocked(row.original)),
        }),
        helper.display({
          id: 'actions',
          size: 60,
          minSize: 60,
          maxSize: 60,
          meta: { align: 'end' },
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) =>
            isLocked(row.original) ? null : (
              <Button
                variant="destructive"
                size="icon"
                className="size-8"
                onClick={() => onRemove(row.original)}
                disabled={disabled}
                aria-label={`Remove ${row.original.email}`}
              >
                <Trash2 className="size-4" />
              </Button>
            ),
        }),
      ]),
    // `isLocked` closes over `currentUserId`, which is already a dependency.
    [currentUserId, disabled, renderRoleBadge, renderRoleSelect, onRemove],
  );

  const table = useAppTable({
    data: members,
    columns,
    getRowId: (member) => String(member.id),
    rowCount: members.length,
  });

  return <DataTable table={table} className="hidden md:block" />;
}
