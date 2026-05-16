'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { register } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  checkPasswordRequirements,
  passwordSchema,
} from '@/lib/password-validation';

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <Check className="size-3 text-green-500" />
      ) : (
        <X className="size-3 text-muted-foreground" />
      )}
      <span className={met ? 'text-green-500' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const password = useWatch({ control: form.control, name: 'password' });
  const requirements = checkPasswordRequirements(password || '');

  const onSubmit = (data: RegisterFormData) => {
    form.clearErrors();

    startTransition(async () => {
      const result = await register({
        email: data.email,
        password: data.password,
      });

      if (result.success) {
        router.push('/projects');
      } else if (result.error === 'email_exists') {
        form.setError('email', {
          type: 'server',
          message: 'An account with this email already exists',
        });
      } else if (result.error === 'weak_password') {
        form.setError('password', {
          type: 'server',
          message: result.message || 'Password does not meet requirements',
        });
      } else {
        form.setError('password', {
          type: 'server',
          message: 'An unexpected error occurred. Please try again.',
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Create account</h1>
        <p className="text-muted-foreground">
          Enter your details to create a new account.
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
                <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Password
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Create a password"
                    autoComplete="new-password"
                    disabled={isPending}
                    className="bg-background border-border px-4 py-3.5 text-sm placeholder:text-muted-foreground/30"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                {/* Password requirements */}
                {password && (
                  <div className="space-y-1.5 pt-2">
                    <PasswordRequirement
                      met={requirements.minLength}
                      label="At least 8 characters"
                    />
                    <PasswordRequirement
                      met={requirements.hasUppercase}
                      label="One uppercase letter (A-Z)"
                    />
                    <PasswordRequirement
                      met={requirements.hasLowercase}
                      label="One lowercase letter (a-z)"
                    />
                    <PasswordRequirement
                      met={requirements.hasDigit}
                      label="One digit (0-9)"
                    />
                    <PasswordRequirement
                      met={requirements.notCommon}
                      label="Not a common password"
                    />
                  </div>
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Confirm Password
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    disabled={isPending}
                    className="bg-background border-border px-4 py-3.5 text-sm placeholder:text-muted-foreground/30"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full font-extrabold uppercase tracking-widest text-xs py-6 mt-2"
            disabled={isPending}
          >
            {isPending ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/auth/login"
          className="text-primary hover:underline font-medium"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
