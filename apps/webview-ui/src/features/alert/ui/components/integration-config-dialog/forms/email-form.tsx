'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  createIntegration,
  updateIntegration,
} from '@/features/alert/api/mutations';
import {
  EMAIL_FIELD_MAP,
  type EmailFormData,
  emailDefaults,
  emailFormSchema,
} from '@/features/alert/model/integration-forms';
import { applyServerFieldErrors } from '@/shared/lib/form-errors';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/components/shadcn/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from '@/shared/ui/components/shadcn/form';
import { Input } from '@/shared/ui/components/shadcn/input';
import { ConfigFooter } from '../fields/config-footer';
import { EnabledField } from '../fields/enabled-field';
import { NameField } from '../fields/name-field';
import type { ConfigFormProps } from '../integration-config-dialog';

export function EmailForm({
  onOpenChange,
  existingIntegration,
  onTest,
  onDelete,
  isPending: parentPending,
}: ConfigFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || parentPending;
  const [testRecipients, setTestRecipients] = useState('');

  // Parsed once so the button's enabled state and its payload can never
  // disagree: input that is only commas or spaces yields an empty list, which
  // the server rejects with "must include at least one recipient".
  const parsedRecipients = useMemo(
    () =>
      testRecipients
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
    [testRecipients],
  );

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: emailDefaults(existingIntegration),
  });

  const onSubmit = (data: EmailFormData) => {
    startTransition(async () => {
      const credentials: Record<string, unknown> = {
        smtp_host: data.smtp_host,
        smtp_port: data.smtp_port,
        from_address: data.from_address,
      };
      if (data.smtp_username) credentials.smtp_username = data.smtp_username;
      if (data.smtp_password) credentials.smtp_password = data.smtp_password;

      const result = existingIntegration
        ? await updateIntegration(existingIntegration.id, {
            name: data.name,
            credentials,
            is_enabled: data.is_enabled,
          })
        : await createIntegration({
            name: data.name,
            provider_type: 'email',
            credentials,
            is_enabled: data.is_enabled,
          });

      if (!result.success) {
        const applied = applyServerFieldErrors(form, result.error, {
          map: EMAIL_FIELD_MAP,
          labels: {
            name: 'That name',
            smtp_host: 'That SMTP host',
            smtp_port: 'That SMTP port',
            smtp_username: 'That SMTP username',
            smtp_password: 'That SMTP password',
            from_address: 'That from address',
          },
        });

        if (applied.formLevel) {
          toast.error('Failed to save email integration', {
            description: applied.formLevel,
          });
        }
        return;
      }

      toast.success(
        existingIntegration
          ? 'Email integration updated'
          : 'Email integration created',
      );
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {existingIntegration
            ? 'Edit Email Integration'
            : 'Configure Email (SMTP)'}
        </DialogTitle>
        <DialogDescription>
          Store SMTP credentials here. Specify recipients when creating an alert
          rule.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <NameField<EmailFormData>
            placeholder="e.g., Email Alerts"
            disabled={isLoading}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="smtp_host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    SMTP Host
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="smtp.example.com"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="smtp_port"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Port
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="587"
                      disabled={isLoading}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10) || 587)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="smtp_username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Username (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="username"
                      autoComplete="off"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="smtp_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Password (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="from_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  From Address
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="alerts@rustrak.local"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <EnabledField<EmailFormData> disabled={isLoading} />

          {/* Shown while creating too, disabled — the test endpoint needs a
                persisted integration id, so it only becomes usable on save. */}
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Send a test
            </p>
            <div className="flex gap-2">
              <Input
                aria-label="Test recipients"
                placeholder="test@example.com"
                value={testRecipients}
                onChange={(e) => setTestRecipients(e.target.value)}
                className="h-8 text-xs"
                disabled={isLoading || !existingIntegration}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!existingIntegration || parsedRecipients.length === 0) {
                    return;
                  }
                  onTest(existingIntegration, {
                    recipients: parsedRecipients,
                  });
                }}
                disabled={
                  isLoading ||
                  !existingIntegration ||
                  parsedRecipients.length === 0
                }
              >
                <Play className="size-3.5 mr-1" />
                Test
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {existingIntegration
                ? 'Comma-separate multiple addresses. The test uses the SMTP settings you last saved, not unsaved edits above.'
                : 'Save this integration first to send a test email.'}
            </p>
          </div>

          <ConfigFooter
            existingIntegration={existingIntegration}
            submitLabel={
              existingIntegration ? 'Save Changes' : 'Create Email Integration'
            }
            isLoading={isLoading}
            onDelete={onDelete}
            onCancel={() => onOpenChange(false)}
          />
          {/* Where a failure that named no field of this dialog lands. */}
          <FormRootError />
        </form>
      </Form>
    </>
  );
}
