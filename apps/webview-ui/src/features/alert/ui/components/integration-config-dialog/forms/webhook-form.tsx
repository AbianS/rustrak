'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { filledCredentials } from '@/features/alert/lib/credentials';
import {
  WEBHOOK_FIELD_MAP,
  type WebhookFormData,
  webhookDefaults,
  webhookFormSchema,
} from '@/features/alert/model/integration-forms';
import { useIntegrationSubmit } from '@/features/alert/ui/hooks/use-integration-submit';
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
  const t = useTranslations('alerts');

  const globalT = useTranslations();

  // Seeded at mount, never re-seeded. The body only exists while the dialog
  // is open (Base UI unmounts the portal after the close animation), so
  // "opened again" and "opened on a different integration" are both a fresh
  // mount, and the `key` on the shell makes the second case structural rather
  // than a fact about how the parent sequences its state updates.
  const schema = useMemo(() => webhookFormSchema(t), [t]);
  const form = useForm<WebhookFormData>({
    resolver: zodResolver(schema),
    defaultValues: webhookDefaults(existingIntegration),
  });

  const { submit, isPending } = useIntegrationSubmit<WebhookFormData>({
    form,
    existingIntegration,
    providerType: 'webhook',
    credentials: (data) =>
      filledCredentials({ url: data.url, secret: data.secret }),
    fieldMap: WEBHOOK_FIELD_MAP,
    labels: {
      name: t('common.fieldName'),
      url: t('webhook.fieldUrl'),
      secret: t('webhook.fieldSecret'),
    },
    messages: {
      saveFailed: t('webhook.saveFailed'),
      created: t('webhook.created'),
      updated: t('webhook.updated'),
    },
    t: globalT,
    onSaved: () => onOpenChange(false),
  });

  const isLoading = isPending || parentPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t(existingIntegration ? 'webhook.titleEdit' : 'webhook.titleNew')}
        </DialogTitle>
        <DialogDescription>{t('webhook.description')}</DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <NameField<WebhookFormData>
            placeholder={t('webhook.namePlaceholder')}
            disabled={isLoading}
          />

          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t('webhook.urlLabel')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder={t('webhook.urlPlaceholder')}
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>{t('webhook.urlDescription')}</FormDescription>
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
                  {t('webhook.secretLabel')}
                </FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t('webhook.secretPlaceholder')}
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('webhook.secretDescription')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <EnabledField<WebhookFormData> disabled={isLoading} />

          <ConfigFooter
            existingIntegration={existingIntegration}
            submitLabel={
              existingIntegration
                ? t('common.saveChanges')
                : t('webhook.create')
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
