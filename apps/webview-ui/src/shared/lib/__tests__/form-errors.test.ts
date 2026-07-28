import type { RustrakError } from '@rustrak/client';
import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import {
  applyServerFieldErrors,
  SERVER_ERROR_PATH,
} from '@/shared/lib/form-errors';

type Fields = { name: string; slug: string };

/**
 * A real `useForm` with real `register` calls, not a hand-built double.
 *
 * The guard under test reads the form's own set of registered names, so a fake
 * `setError` with a fake registry would only prove that the fake agrees with
 * itself.
 */
function formWith(registered: (keyof Fields)[]) {
  const { result } = renderHook(() => {
    const form = useForm<Fields>({ defaultValues: { name: '', slug: '' } });
    // `formState` is a proxy that only subscribes to the keys something reads
    // during render. Without touching `errors` here, `setError` never triggers
    // a re-render and every assertion below reads a stale empty object.
    void form.formState.errors;
    return form;
  });

  act(() => {
    for (const field of registered) {
      result.current.register(field);
    }
  });

  return result;
}

/** A 409 naming the given inputs, the shape `fields` was added for. */
function conflict(
  fields: { field: string; code: 'already_exists' }[],
): RustrakError {
  return { kind: 'conflict', status: 409, message: 'Already exists', fields };
}

describe('applyServerFieldErrors', () => {
  it('marks a field the form registers', () => {
    const form = formWith(['name', 'slug']);

    act(() => {
      applyServerFieldErrors(
        form.current,
        conflict([{ field: 'slug', code: 'already_exists' }]),
      );
    });

    expect(form.current.formState.errors.slug?.message).toBe(
      'This value is already taken.',
    );
    expect(form.current.formState.errors.root?.serverError).toBeUndefined();
  });

  // The guard. React-hook-form keeps an error set on an unregistered name until
  // `clearErrors()` is called by hand: nothing is bound to it, so no keystroke
  // and no re-validation clears it, and the form refuses to submit with nothing
  // on screen saying why.
  it('never calls setError with a field the form does not register', () => {
    const form = formWith(['name', 'slug']);
    const marked: string[] = [];
    const originalSetError = form.current.setError;
    form.current.setError = ((name: string, ...rest: unknown[]) => {
      marked.push(name);
      return (originalSetError as (...args: unknown[]) => void)(name, ...rest);
    }) as typeof form.current.setError;

    let applied: ReturnType<typeof applyServerFieldErrors> | undefined;
    act(() => {
      applied = applyServerFieldErrors(
        form.current,
        conflict([
          { field: 'credentials.webhook_url', code: 'already_exists' },
        ]),
      );
    });

    expect(marked).not.toContain('credentials.webhook_url');
    expect(marked).toEqual([SERVER_ERROR_PATH]);
    expect(applied?.marked).toEqual([]);
    expect(form.current.formState.errors.root?.serverError?.message).toBe(
      'This value is already taken.',
    );
  });

  it('routes the unknown half to the form-level slot and still marks the known half', () => {
    const form = formWith(['name', 'slug']);

    let applied: ReturnType<typeof applyServerFieldErrors> | undefined;
    act(() => {
      applied = applyServerFieldErrors(
        form.current,
        conflict([
          { field: 'name', code: 'already_exists' },
          { field: 'nope', code: 'already_exists' },
        ]),
      );
    });

    expect(applied?.marked).toEqual(['name']);
    expect(applied?.formLevel).toBe('This value is already taken.');
    expect(form.current.formState.errors.name).toBeDefined();
  });

  // The maps the integration dialogs carry: flat inputs, one nested body key.
  it('applies the map before asking whether the name is registered', () => {
    const form = formWith(['name', 'slug']);

    act(() => {
      applyServerFieldErrors(
        form.current,
        conflict([{ field: 'credentials.slug', code: 'already_exists' }]),
        { map: { 'credentials.slug': 'slug' }, labels: { slug: 'Slug' } },
      );
    });

    expect(form.current.formState.errors.slug?.message).toBe(
      'Slug is already taken.',
    );
    expect(form.current.formState.errors.root?.serverError).toBeUndefined();
  });

  it('falls back to the form-level slot when the server named nothing', () => {
    const form = formWith(['name', 'slug']);

    let applied: ReturnType<typeof applyServerFieldErrors> | undefined;
    act(() => {
      applied = applyServerFieldErrors(form.current, {
        kind: 'network',
        message: 'The request could not reach the server.',
        reason: 'unreachable',
      });
    });

    expect(applied?.marked).toEqual([]);
    // The app's own sentence for `network`, not the client's raw `message` and
    // not a caller-supplied title. This is the regression the shared copy
    // module exists to prevent: every caller used to pass its toast title here,
    // so an unreachable API produced "Failed to create project" twice and the
    // user was never told the server was down.
    expect(form.current.formState.errors.root?.serverError?.message).toBe(
      'The Rustrak API could not be reached.',
    );
    expect(form.current.formState.errors.name).toBeUndefined();
    expect(form.current.formState.errors.slug).toBeUndefined();
  });

  it('distinguishes an outage from a rejection in the form-level slot', () => {
    const outage = formWith(['name']);
    act(() => {
      applyServerFieldErrors(outage.current, {
        kind: 'server_error',
        status: 500,
        message: 'redacted',
      });
    });

    const denied = formWith(['name']);
    act(() => {
      applyServerFieldErrors(denied.current, {
        kind: 'forbidden',
        status: 403,
        message: 'Admin access required.',
      });
    });

    // Two failures a user must respond to differently must not read the same.
    expect(outage.current.formState.errors.root?.serverError?.message).not.toBe(
      denied.current.formState.errors.root?.serverError?.message,
    );
    expect(denied.current.formState.errors.root?.serverError?.message).toBe(
      'Your account is not allowed to do this.',
    );
  });

  it('sends a second reason for the same field to the form-level slot', () => {
    const form = formWith(['name']);

    let applied: ReturnType<typeof applyServerFieldErrors> | undefined;
    act(() => {
      applied = applyServerFieldErrors(
        form.current,
        conflict([
          { field: 'name', code: 'already_exists' },
          { field: 'name', code: 'already_exists' },
        ]),
        { labels: { name: 'Project name' } },
      );
    });

    // `setError` replaces rather than appends, so marking the same input twice
    // would silently drop the first reason and the user would fix one problem
    // only to meet the other on the next submit.
    expect(applied?.marked).toEqual(['name']);
    expect(applied?.formLevel).toBe('Project name is already taken.');
  });

  it('does not mark a registered field whose input has been unmounted', () => {
    const form = formWith(['name']);

    // What a Radix `TabsContent` does to the field in the inactive tab.
    // react-hook-form's default `shouldUnregister: false` keeps the name in
    // its mount set forever, so the mount set alone would approve this and the
    // message would land on an input nobody can see: no visible error, no
    // toast, and a Save button that appears to do nothing.
    act(() => {
      const input = document.createElement('input');
      input.name = 'name';
      form.current.register('name').ref(input);
    });

    let applied: ReturnType<typeof applyServerFieldErrors> | undefined;
    act(() => {
      applied = applyServerFieldErrors(
        form.current,
        conflict([{ field: 'name', code: 'already_exists' }]),
        { labels: { name: 'Project name' } },
      );
    });

    expect(applied?.marked).toEqual([]);
    expect(applied?.formLevel).toBe('Project name is already taken.');
    expect(form.current.formState.errors.name).toBeUndefined();
  });

  it('renders a custom code verbatim, the one code whose meaning is its message', () => {
    const form = formWith(['name']);

    act(() => {
      applyServerFieldErrors(form.current, {
        kind: 'validation',
        status: 400,
        message: 'Rejected',
        fields: [
          {
            field: 'name',
            code: 'custom',
            message: 'Reserved for internal use',
          },
        ],
      });
    });

    expect(form.current.formState.errors.name?.message).toBe(
      'Reserved for internal use',
    );
  });

  it('clears a previous form-level message before applying the next failure', () => {
    const form = formWith(['name']);

    act(() => {
      applyServerFieldErrors(form.current, {
        kind: 'server_error',
        status: 500,
        message: 'The server failed to handle the request.',
      });
    });
    expect(form.current.formState.errors.root?.serverError).toBeDefined();

    act(() => {
      applyServerFieldErrors(
        form.current,
        conflict([{ field: 'name', code: 'already_exists' }]),
      );
    });

    expect(form.current.formState.errors.root?.serverError).toBeUndefined();
    expect(form.current.formState.errors.name).toBeDefined();
  });
});
