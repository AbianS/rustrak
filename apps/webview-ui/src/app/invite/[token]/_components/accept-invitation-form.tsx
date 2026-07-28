'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { acceptInvitation } from '@/features/user/api/mutations';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/components/shadcn/form';
import { Input } from '@/shared/ui/components/shadcn/input';
import { Label } from '@/shared/ui/components/shadcn/label';

const acceptSchema = z
  .object({
    password: z.string().min(1, 'Password is required'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type AcceptFormData = z.infer<typeof acceptSchema>;

interface AcceptInvitationFormProps {
  token: string;
  email: string;
}

export function AcceptInvitationForm({
  token,
  email,
}: AcceptInvitationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AcceptFormData>({
    resolver: zodResolver(acceptSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (data: AcceptFormData) => {
    form.clearErrors();

    startTransition(async () => {
      const result = await acceptInvitation({ token, password: data.password });

      if (result.success) {
        router.push('/projects');
      } else {
        form.setError('confirmPassword', {
          type: 'server',
          message: result.error.message,
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Accept invitation</h1>
        <p className="text-muted-foreground">
          Set a password to finish creating your account.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Email
        </Label>
        <Input value={email} readOnly disabled className="bg-background" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    placeholder="Choose a password"
                    autoComplete="new-password"
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
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Confirm password
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    disabled={isPending}
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
            {isPending ? 'Creating account...' : 'Accept & continue'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
