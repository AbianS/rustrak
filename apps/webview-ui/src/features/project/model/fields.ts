import { z } from 'zod';
import type { Translate } from '@/shared/lib/error-copy';

const PROJECT_NAME_MIN_LENGTH = 2;
export const PROJECT_NAME_MAX_LENGTH = 100;

/** The message keys this module resolves, and their English forms. */
const EN: Record<string, string> = {
  'fields.nameTooShort': 'Name must be at least {min} characters',
  'fields.nameTooLong': 'Name must be at most {max} characters',
  'fields.slugEmpty': 'Slug cannot be empty',
  'fields.slugChars': 'Use lowercase letters, digits and dashes',
};

/** Resolve one key through `t` when present, the English dictionary otherwise. */
function text(
  t: Translate | undefined,
  key: string,
  values?: Record<string, string | number>,
): string {
  if (t) return t(key, values);
  let message = EN[key] ?? key;
  for (const [name, value] of Object.entries(values ?? {})) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
}

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
export function projectNameField(t?: Translate) {
  return z
    .string()
    .trim()
    .min(
      PROJECT_NAME_MIN_LENGTH,
      text(t, 'fields.nameTooShort', { min: PROJECT_NAME_MIN_LENGTH }),
    )
    .max(
      PROJECT_NAME_MAX_LENGTH,
      text(t, 'fields.nameTooLong', { max: PROJECT_NAME_MAX_LENGTH }),
    );
}

/** The rules for a project slug, shared for the same reason. */
export function projectSlugField(t?: Translate) {
  return z
    .string()
    .trim()
    .min(1, text(t, 'fields.slugEmpty'))
    .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, text(t, 'fields.slugChars'));
}

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
