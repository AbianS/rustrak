import type { ProjectRole } from '@rustrak/client';

/**
 * The roles a person can hold on a project, in ascending order of power.
 *
 * In `model` rather than beside the table that renders them: the members
 * table, the add-member dialog and the toast that confirms a change all name
 * these, and none of the three owns the vocabulary.
 */
export const PROJECT_ROLES: { value: ProjectRole; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
  { value: 'admin', label: 'Admin' },
];

export const roleLabel = (role: ProjectRole): string =>
  PROJECT_ROLES.find((entry) => entry.value === role)?.label ?? role;
