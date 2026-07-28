'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { RustrakError } from '@rustrak/client';
import { Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { login } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SERVER_ERROR_PATH } from '@/lib/form-errors';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Copy for a failure that is not a verdict on the credentials.
 *
 * `rate_limited` is called out because the generic sentence ends "Please try
 * again", and on a login page behind a proxy rate-limit that is the one
 * instruction that makes things worse: every retry extends the block.
 */
function loginFailureMessage(error: RustrakError): string {
  switch (error.kind) {
    case 'network':
      return 'Could not reach the server. Check your connection and try again.';
    case 'rate_limited':
      // `retryAfter` is reachable only on this arm, which is what branching on
      // the client's own union buys over a flattened domain enum.
      return error.retryAfter && error.retryAfter > 0
        ? `Too many login attempts. Wait about ${formatWait(error.retryAfter)} before trying again.`
        : 'Too many login attempts. Wait a few minutes before trying again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(seconds / 3600);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (data: LoginFormData) => {
    form.clearErrors();

    startTransition(async () => {
      const result = await login(data);

      if (result.success) {
        router.push('/');
        return;
      }

      if (result.error.kind === 'unauthenticated') {
        // **This form deliberately gets no per-field errors, and that is not an
        // oversight the field-error work should "fix".**
        //
        // Every other form in the app now reads `error.fields` and marks the
        // input the server named. Login must not, because here the server's
        // answer is itself the secret. "This email exists but the password is
        // wrong" is user enumeration: it turns the login page into an oracle
        // that confirms whether an address has an account, which is the first
        // step of a credential-stuffing run and, on a self-hosted instance, of
        // working out who the team is.
        //
        // So all three real outcomes -- unknown address, wrong password,
        // disabled account -- collapse into this one sentence, and it is
        // attached to `password` only so it lands next to the field the user
        // will retype. The server helps by making them indistinguishable
        // upstream too: it checks `is_active` *before* verifying the password,
        // so a distinct "account disabled" answer would leak the same fact.
        form.setError('password', {
          type: 'server',
          message: 'Invalid email or password',
        });
        return;
      }

      // Not a verdict on the credentials, so it does not go on a credential
      // field. "An unexpected error occurred" under the password box, when the
      // API is simply down, sends the user off to retype a password that was
      // right all along.
      //
      // The path is imported rather than written out: `FormRootError` reads
      // the same key, so a literal here would be a third copy of a constant
      // nothing checks.
      form.setError(SERVER_ERROR_PATH, {
        type: 'server',
        message: loginFailureMessage(result.error),
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Log in</h1>
        <p className="text-muted-foreground">
          Enter your credentials to access the platform.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Email Address
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    autoComplete="email"
                    disabled={isPending}
                    className="bg-background border-border px-4 py-3.5 text-sm placeholder:text-muted-foreground/30"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Password
                  </FormLabel>
                </div>
                <FormControl>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={isPending}
                      className="h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-4 py-3.5 pr-10 text-sm shadow-xs outline-none placeholder:text-muted-foreground/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      disabled={isPending}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      tabIndex={-1}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Where an outage lands, kept off the credential fields. */}
          <FormRootError />

          <Button
            type="submit"
            className="w-full font-extrabold uppercase tracking-widest text-xs py-6 mt-2"
            disabled={isPending}
          >
            {isPending ? 'Signing in...' : 'Login'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
