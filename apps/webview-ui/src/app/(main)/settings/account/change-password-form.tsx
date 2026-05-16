'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { changePassword } from '@/actions/auth';
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

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

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

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  });

  const newPassword = useWatch({
    control: form.control,
    name: 'newPassword',
  });
  const requirements = checkPasswordRequirements(newPassword || '');

  const onSubmit = (data: ChangePasswordFormData) => {
    form.clearErrors();
    setSuccess(false);

    startTransition(async () => {
      const result = await changePassword({
        current_password: data.currentPassword,
        new_password: data.newPassword,
      });

      if (result.success) {
        setSuccess(true);
        form.reset();
      } else if (result.error === 'invalid_current_password') {
        form.setError('currentPassword', {
          type: 'server',
          message: 'Current password is incorrect',
        });
      } else if (result.error === 'weak_password') {
        form.setError('newPassword', {
          type: 'server',
          message: result.message || 'Password does not meet requirements',
        });
      } else {
        form.setError('newPassword', {
          type: 'server',
          message: 'An unexpected error occurred. Please try again.',
        });
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {success && (
          <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-500">
            Password changed successfully.
          </div>
        )}

        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Current Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
              {/* Password requirements */}
              {newPassword && (
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
              <FormLabel>Confirm New Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Confirm your new password"
                  autoComplete="new-password"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending}>
          {isPending ? 'Changing password...' : 'Change password'}
        </Button>
      </form>
    </Form>
  );
}
