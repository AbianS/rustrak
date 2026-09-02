import type { RustrakError } from '@rustrak/client';
import type { Translator } from '@rustrak/i18n';
import {
  ArrowRightIcon,
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  InputAction,
  Text,
  WatchIcon,
} from '@rustrak/ui';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';

// Shape only. Whether the pair opens an account is the server's answer.
const schemaFor = (t: Translator) =>
  z.object({
    email: z.email(t.t('auth.form.emailInvalid')),
    password: z.string().min(1, t.t('auth.form.passwordRequired')),
  });

// `rate_limited` is called out because the generic copy ends "try again",
// and retrying is what extends the block.
function failureMessage(error: RustrakError, t: Translator): string {
  switch (error.kind) {
    case 'network':
      return t.t('auth.form.failureNetwork');
    case 'rate_limited':
      return error.retryAfter && error.retryAfter > 0
        ? t.t('auth.form.failureRateLimited', {
            duration: formatWait(error.retryAfter, t),
          })
        : t.t('auth.form.failureRateLimitedGeneric');
    default:
      return t.t('auth.form.failureUnexpected');
  }
}

// Rounds up, never down: telling someone to wait 1 minute for 61 seconds
// invites the retry that extends the block. The catalogs carry the plural
// rules, so a language with a `few` category gets one.
function formatWait(seconds: number, t: Translator): string {
  if (seconds < 60) return t.t('auth.form.waitSeconds', { count: seconds });
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return t.t('auth.form.waitMinutes', { count: minutes });
  return t.t('auth.form.waitHours', { count: Math.ceil(seconds / 3600) });
}

export interface LoginFormProps {
  t: Translator;
  /**
   * Runs the credentials. `rejected` is the server refusing the pair; `error`
   * is everything that is not a verdict on them.
   */
  onSubmit: (credentials: {
    email: string;
    password: string;
  }) => Promise<{ rejected: boolean; error?: RustrakError }>;
}

export function LoginForm({ onSubmit, t }: LoginFormProps) {
  const [revealed, setRevealed] = useState(false);
  // Held outside the form: neither is a schema error, so neither belongs in
  // the field error map.
  const [rejected, setRejected] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: '', password: '' },
    // Not `onChange`: flagging an address while the `@` is still being typed
    // is what makes a form feel hostile.
    validators: { onSubmit: schemaFor(t) },
    onSubmit: async ({ value }) => {
      setRejected(false);
      setFailure(null);

      const result = await onSubmit(value);

      if (result.rejected) {
        setRejected(true);
        return;
      }
      if (result.error) {
        setFailure(failureMessage(result.error, t));
      }
    },
  });

  return (
    <form
      className="flex w-full max-w-100 flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-page-title text-fg">{t.t('auth.form.title')}</h1>
        <Text tone="secondary" variant="body">
          {t.t('auth.form.subtitle')}
        </Text>
      </div>

      <div className="flex flex-col gap-3.5">
        <form.Field name="email">
          {(field) => {
            const invalid = !field.state.meta.isValid;

            return (
              /*
               * Both: `Field` marks the group for the label and message, `Input`
               * puts `data-invalid` inside the box, which is what the border
               * selector matches.
               */
              <Field invalid={invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t.t('auth.form.emailLabel')}
                </FieldLabel>
                <Input
                  autoComplete="email"
                  autoFocus
                  id={field.name}
                  invalid={invalid}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder={t.t('auth.form.emailPlaceholder')}
                  type="email"
                  value={field.state.value}
                />
                <FieldError match={invalid}>
                  {field.state.meta.errors[0]?.message}
                </FieldError>
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="password">
          {(field) => {
            const invalid = rejected || !field.state.meta.isValid;

            return (
              // A rejection is about the pair; see the note in the route.
              <Field invalid={invalid}>
                <FieldLabel htmlFor={field.name}>
                  {t.t('auth.form.passwordLabel')}
                </FieldLabel>
                <Input
                  action={
                    <InputAction
                      aria-label={t.t(
                        revealed
                          ? 'auth.form.hidePassword'
                          : 'auth.form.showPassword',
                      )}
                      aria-pressed={revealed}
                      icon={WatchIcon}
                      onClick={() => setRevealed((shown) => !shown)}
                      tabIndex={-1}
                      type="button"
                    />
                  }
                  autoComplete="current-password"
                  id={field.name}
                  invalid={invalid}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  type={revealed ? 'text' : 'password'}
                  value={field.state.value}
                />
                <FieldError match={invalid}>
                  {field.state.meta.errors[0]?.message ??
                    t.t('auth.form.invalidCredentials')}
                </FieldError>
              </Field>
            );
          }}
        </form.Field>

        {failure ? (
          <div
            className="rounded-sm border border-danger bg-danger-surface px-3 py-2"
            role="alert"
          >
            <Text tone="error" variant="hint">
              {failure}
            </Text>
          </div>
        ) : null}

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              className="mt-1 w-full"
              disabled={!canSubmit}
              icon={ArrowRightIcon}
              loading={isSubmitting}
              size="lg"
              type="submit"
              variant="primary"
            >
              {t.t('auth.form.login')}
            </Button>
          )}
        </form.Subscribe>
      </div>

      <div className="border-t border-border-divider pt-5">
        <Text tone="muted" variant="hint">
          {t.t('auth.form.noAccount')}
        </Text>
      </div>
    </form>
  );
}
