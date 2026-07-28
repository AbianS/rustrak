'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  createIntegration,
  updateIntegration,
} from '@/features/alert/api/mutations';
import {
  WEBHOOK_FIELD_MAP,
  type WebhookFormData,
  webhookDefaults,
  webhookFormSchema,
} from '@/features/alert/model/integration-forms';
import { applyServerFieldErrors } from '@/shared/lib/form-errors';
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/components/shadcn/dialog';
import {
  Form,
  FormControl,
  FormDescription,
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

export function WebhookForm({
  onOpenChange,
  existingIntegration,
  onTest,
  onDelete,
  isPending: parentPending,
}: ConfigFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || parentPending;

  // Seeded at mount, never re-seeded. The body only exists while the dialog
  // is open (Base UI unmounts the portal after the close animation), so
  // "opened again" and "opened on a different integration" are both a fresh
  // mount, and the `key` on the shell makes the second case structural rather
  // than a fact about how the parent sequences its state updates.
  const form = useForm<WebhookFormData>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: webhookDefaults(existingIntegration),
  });

  const onSubmit = (data: WebhookFormData) => {
    startTransition(async () => {
      const credentials: Record<string, unknown> = {};
      if (data.url && data.url.trim() !== '') credentials.url = data.url;
      if (data.secret && data.secret.trim() !== '')
        credentials.secret = data.secret;

      const result = existingIntegration
        ? await updateIntegration(existingIntegration.id, {
            name: data.name,
            credentials,
            is_enabled: data.is_enabled,
          })
        : await createIntegration({
            name: data.name,
            provider_type: 'webhook',
            credentials,
            is_enabled: data.is_enabled,
          });

      if (!result.success) {
        const applied = applyServerFieldErrors(form, result.error, {
          map: WEBHOOK_FIELD_MAP,
          labels: {
            name: 'That name',
            url: 'That URL',
            secret: 'That secret',
          },
        });

        if (applied.formLevel) {
          toast.error('Failed to save webhook', {
            description: applied.formLevel,
          });
        }
        return;
      }

      toast.success(
        existingIntegration ? 'Webhook updated' : 'Webhook created',
      );
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {existingIntegration ? 'Edit Webhook' : 'Configure Webhook'}
        </DialogTitle>
        <DialogDescription>
          POST JSON payloads to external API endpoints. Specify the target URL
          here (global default) or per-alert-rule as an override.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <NameField<WebhookFormData>
            placeholder="e.g., Production Alerts"
            disabled={isLoading}
          />

          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Default URL (optional)
                </FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder="https://example.com/webhook"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Leave blank to require a URL override per alert rule.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="secret"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Secret (optional)
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="HMAC signing secret"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Used to sign payloads with HMAC-SHA256
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <EnabledField<WebhookFormData> disabled={isLoading} />

          <ConfigFooter
            existingIntegration={existingIntegration}
            submitLabel={
              existingIntegration ? 'Save Changes' : 'Create Webhook'
            }
            isLoading={isLoading}
            onTest={onTest}
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
