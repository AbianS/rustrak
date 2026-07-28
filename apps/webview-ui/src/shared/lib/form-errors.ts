import type { FieldErrorCode, RustrakError } from '@rustrak/client';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { describeError } from '@/shared/lib/error-copy';

/**
 * The one form-level slot every server failure falls back to.
 *
 * `root.*` names are special in react-hook-form: they are not fields, they hold
 * no value, and they are cleared on the next submit. That is exactly what a
 * server-reported failure needs, and it is why an unattributable failure goes
 * here rather than onto a real field.
 */
export const SERVER_ERROR_PATH = 'root.serverError';

/**
 * Maps a server field path onto the name this form registers.
 *
 * Needed whenever the request body's shape is not the form's shape. The alert
 * integration dialogs are the reason it exists: they render flat inputs (`url`,
 * `secret`, `smtp_host`) and post them nested inside one opaque `credentials`
 * object, so the server can only ever name `credentials.url`. Without a map
 * that path matches nothing and the message ends up in the form-level slot,
 * which is correct but strictly less useful than marking the input.
 */
export type ServerFieldMap = Readonly<Record<string, string>>;

export interface ApplyServerFieldErrorsOptions {
  /** Server dot path -> the name this form registers. */
  readonly map?: ServerFieldMap;
  /**
   * Human label per **form** field name, used to build the copy.
   * `slug` -> `'Slug'` turns `already_exists` into "Slug is already taken."
   */
  readonly labels?: Readonly<Record<string, string>>;
}

export interface AppliedServerFieldErrors {
  /** Form field names that were marked on their own input. */
  readonly marked: readonly string[];
  /**
   * The message placed on {@link SERVER_ERROR_PATH}, or `null` when every part
   * of the failure landed on an input. A caller that wants a toast should raise
   * one only when this is non-null: a toast beside a marked input is noise.
   */
  readonly formLevel: string | null;
}

/**
 * Put a `RustrakError` onto a react-hook-form instance, field by field.
 *
 * **The guard is the point of this function.** `setError('slug', ...)` on a
 * form that has no `slug` input registers an error react-hook-form will never
 * clear on its own: it is not attached to a value, so no keystroke and no
 * re-validation touches it, and only a hand-written `clearErrors()` removes it.
 * The form then refuses to submit with nothing on screen explaining why. So a
 * server field path is marked only when the form actually registers that name;
 * everything else falls through to {@link SERVER_ERROR_PATH}, which is visible,
 * self-clearing, and cannot strand the user.
 *
 * Copy comes from `(field, code)`, never from `message`, which is what makes it
 * translatable later. The single exception is `code: 'custom'`, where the code
 * set genuinely cannot express the reason and the server's own text is rendered
 * verbatim; the client already strips a `message` arriving on any other code.
 */
export function applyServerFieldErrors<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  error: RustrakError,
  options: ApplyServerFieldErrorsOptions = {},
): AppliedServerFieldErrors {
  const { map = {}, labels = {} } = options;

  // A stale form-level message outliving the failure that caused it reads as a
  // second, phantom rejection. Clear before writing, not after.
  form.clearErrors(SERVER_ERROR_PATH as Path<TFieldValues>);

  const fields = 'fields' in error ? (error.fields ?? []) : [];

  const marked: string[] = [];
  const unattributed: string[] = [];

  for (const fieldError of fields) {
    const name = map[fieldError.field] ?? fieldError.field;
    const message = copyFor(fieldError.code, labels[name], fieldError.message);

    // A second entry for a name already marked cannot go on the same input:
    // `setError` replaces rather than appends, so the first reason would
    // vanish and the user would fix one problem only to meet the other on the
    // next submit. The extra reason goes to the form-level slot instead.
    if (!canMark(form, name) || marked.includes(name)) {
      unattributed.push(message);
      continue;
    }

    form.setError(name as Path<TFieldValues>, { type: 'server', message });
    marked.push(name);
  }

  // Nothing named, or nothing nameable: the failure still has to be visible,
  // and it has to say what actually happened. This used to render a caller-
  // supplied `fallbackMessage`, which every caller set to the same string it
  // was already using as the toast title -- so an unreachable API produced a
  // toast reading "Failed to create project / Failed to create project" and
  // the user was never told the server was down.
  if (fields.length === 0) {
    unattributed.push(describeError(error));
  }

  if (unattributed.length === 0) {
    return { marked, formLevel: null };
  }

  const formLevel = unattributed.join(' ');
  form.setError(SERVER_ERROR_PATH as Path<TFieldValues>, {
    type: 'server',
    message: formLevel,
  });

  return { marked, formLevel };
}

/**
 * Whether an error on `name` would actually be visible to the user.
 *
 * Two questions, because one is not enough.
 *
 * `control._names.mount` answers "has this name ever been registered". It is
 * **cumulative**: react-hook-form's default `shouldUnregister: false` keeps a
 * name in the set after its input unmounts, so on its own it will happily
 * approve a field that is no longer on screen. That matters here because the
 * Slack dialog puts `webhook_url` and `token` in opposite Radix tabs, which
 * unmount, and marking the hidden one produces exactly the silent dead end
 * this guard exists to prevent: no visible message, no toast, and a Save
 * button that appears to do nothing.
 *
 * So the second question is asked of the DOM: if the field registered a real
 * node, that node has to still be connected. A controlled field (a Radix
 * `Select`, our `PlatformPicker`) registers a plain `{ name }` object with no
 * node, and there is nothing to test, so the mount set is trusted.
 *
 * Both reads are of react-hook-form internals and both are defensive: if a
 * future version changes either shape, this returns `false` and the message
 * routes to {@link SERVER_ERROR_PATH}, which is visible, self-clearing and
 * cannot strand anyone. Losing precision is the right direction to fail in.
 */
function canMark<TFieldValues extends FieldValues>(
  form: UseFormReturn<TFieldValues>,
  name: string,
): boolean {
  const control = form.control as {
    _names?: { mount?: unknown };
    _fields?: unknown;
  };

  const mount = control._names?.mount;
  if (!(mount instanceof Set) || !mount.has(name)) return false;

  const ref = fieldRef(control._fields, name);
  if (ref instanceof Node) return ref.isConnected;

  return true;
}

/**
 * The DOM node react-hook-form holds for `name`, if it holds one.
 *
 * Walks the dotted path because `_fields` is nested the way the values are.
 */
function fieldRef(fields: unknown, name: string): unknown {
  let node = fields;

  for (const segment of name.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }

  if (typeof node !== 'object' || node === null) return undefined;
  const leaf = (node as { _f?: { ref?: unknown } })._f;

  return leaf?.ref;
}

/**
 * The app's own copy for one `(field, code)` pair.
 *
 * `label` is the form's word for the input, so the sentence reads as the user's
 * own vocabulary rather than the API's.
 */
function copyFor(
  code: FieldErrorCode,
  label: string | undefined,
  serverMessage: string | undefined,
): string {
  if (code === 'custom') {
    // The one code whose meaning lives in the message. The server sends it
    // precisely because the code set could not express the reason.
    return serverMessage ?? 'This value was rejected.';
  }

  const subject = label ?? 'This value';

  switch (code) {
    case 'required':
      return `${subject} is required.`;
    case 'invalid':
      return `${subject} is not valid.`;
    case 'already_exists':
      return `${subject} is already taken.`;
    case 'too_short':
      return `${subject} is too short.`;
    case 'too_long':
      return `${subject} is too long.`;
  }
}
