import type { ProjectRole } from '@rustrak/client';

/**
 * The roles a person can hold on a project, in ascending order of power.
 *
 * In `model` rather than beside the table that renders them: the members
 * table, the add-member dialog and the toast that confirms a change all name
 * these, and none of the three owns the vocabulary.
 */
export const PROJECT_ROLES: { value: ProjectRole; labelKey: string }[] = [
  { value: 'viewer', labelKey: 'roles.viewer' },
  { value: 'editor', labelKey: 'roles.editor' },
  { value: 'admin', labelKey: 'roles.admin' },
];

/**
 * The message key naming one project role, e.g. `roles.admin`.
 *
 * Returns a key, not the label itself: this module is portable core and does
 * not know the translator, so the caller resolves it, `t(roleLabel(role))`.
 */
export const roleLabel = (role: ProjectRole): string =>
  PROJECT_ROLES.find((entry) => entry.value === role)?.labelKey ?? role;
