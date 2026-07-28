import { z } from 'zod';

const PROJECT_NAME_MIN_LENGTH = 2;
export const PROJECT_NAME_MAX_LENGTH = 100;

/**
 * The rules for a project name, shared by the create form and the general
 * settings form.
 *
 * They lived only in the create form, so renaming a project in settings had no
 * client-side rules at all: a one-character name was accepted by the field,
 * sent, and rejected by the server. Two forms editing the same column must
 * agree about what that column accepts, which is what makes this shared rather
 * than copied.
 */
export const projectNameField = z
  .string()
  .trim()
  .min(
    PROJECT_NAME_MIN_LENGTH,
    `Name must be at least ${PROJECT_NAME_MIN_LENGTH} characters`,
  )
  .max(
    PROJECT_NAME_MAX_LENGTH,
    `Name must be at most ${PROJECT_NAME_MAX_LENGTH} characters`,
  );

/** The rules for a project slug, shared for the same reason. */
export const projectSlugField = z
  .string()
  .trim()
  .min(1, 'Slug cannot be empty')
  .regex(
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/,
    'Use lowercase letters, digits and dashes',
  );

/**
 * Live preview slugifier, ported from Sentry's `utils/slugify`.
 *
 * Deliberately does NOT trim leading or trailing hyphens: doing so would make
 * it impossible to type "my-app", since the hyphen would vanish the moment it
 * is typed. The server slugifies again and is the real authority.
 */
export function slugifyPreview(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]/g, '')
    .replace(/[-\s]+/g, '-');
}
