'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { filledCredentials } from '@/features/alert/lib/credentials';
import {
  CUSTOM_WEBHOOK_FIELD_MAP,
  type CustomWebhookFormData,
  customWebhookDefaults,
  customWebhookFormSchema,
} from '@/features/alert/model/integration-forms';
import {
  RESPONSE_CHECKS,
  type ResponseCheck,
  templatePlaceholder,
  type WebhookPreset,
  webhookPresets,
} from '@/features/alert/model/webhook-presets';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/components/shadcn/select';
import { Textarea } from '@/shared/ui/components/shadcn/textarea';
import { ConfigFooter } from '../fields/config-footer';
import { EnabledField } from '../fields/enabled-field';
import { NameField } from '../fields/name-field';
import type { ConfigFormProps } from '../integration-config-dialog';

export function CustomWebhookForm({
  onOpenChange,
  existingIntegration,
  onTest,
  onDelete,
  isPending: parentPending,
}: ConfigFormProps) {
  const t = useTranslations('alerts');

  const globalT = useTranslations();

  const schema = useMemo(() => customWebhookFormSchema(t), [t]);
  const form = useForm<CustomWebhookFormData>({
    resolver: zodResolver(schema),
    defaultValues: customWebhookDefaults(existingIntegration),
  });

  const { submit, isPending } = useIntegrationSubmit<CustomWebhookFormData>({
    form,
    existingIntegration,
    providerType: 'custom_webhook',
    credentials: (data) =>
      filledCredentials({
        url: data.url,
        secret: data.secret,
        template: data.template,
        response_check: data.response_check,
      }),
    fieldMap: CUSTOM_WEBHOOK_FIELD_MAP,
    labels: {
      name: t('common.fieldName'),
      url: t('webhook.fieldUrl'),
      secret: t('webhook.fieldSecret'),
      template: t('customWebhook.fieldTemplate'),
      response_check: t('customWebhook.fieldResponseCheck'),
    },
    messages: {
      saveFailed: t('customWebhook.saveFailed'),
      created: t('customWebhook.created'),
      updated: t('customWebhook.updated'),
    },
    t: globalT,
    onSaved: () => onOpenChange(false),
  });

  const isLoading = isPending || parentPending;

  // A preset is one choice, not two: the body a platform expects and the reply
  // it answers with belong together, so picking it sets both.
  const applyPreset = (preset: WebhookPreset) => {
    for (const [field, value] of [
      ['template', preset.template],
      ['response_check', preset.responseCheck],
    ] as const) {
      form.setValue(field, value, { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t(
            existingIntegration
              ? 'customWebhook.titleEdit'
              : 'customWebhook.titleNew',
          )}
        </DialogTitle>
        <DialogDescription>{t('customWebhook.description')}</DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <NameField<CustomWebhookFormData>
            placeholder={t('customWebhook.namePlaceholder')}
            disabled={isLoading}
          />

          <FormField
            control={form.control}
            name="template"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t('customWebhook.templateLabel')}
                </FormLabel>
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {webhookPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={isLoading}
                      onClick={() => applyPreset(preset)}
                      className="rounded-md border border-input px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      {t(`customWebhook.presets.${preset.labelKey}`)}
                    </button>
                  ))}
                </div>
                <FormControl>
                  <Textarea
                    className="font-mono text-xs min-h-28"
                    placeholder={templatePlaceholder}
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('customWebhook.templateDescription')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
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
                    placeholder={t('customWebhook.urlPlaceholder')}
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
            name="response_check"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t('customWebhook.responseCheckLabel')}
                </FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    if (value) field.onChange(value as ResponseCheck);
                  }}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger
                      className="w-full"
                      aria-label={t('customWebhook.responseCheckLabel')}
                    >
                      <SelectValue>
                        {(value) =>
                          t(`customWebhook.responseChecks.${value as string}`)
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {RESPONSE_CHECKS.map((check) => (
                      <SelectItem key={check} value={check}>
                        {t(`customWebhook.responseChecks.${check}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t('customWebhook.responseCheckDescription')}
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

          <EnabledField<CustomWebhookFormData> disabled={isLoading} />

          <ConfigFooter
            existingIntegration={existingIntegration}
            submitLabel={
              existingIntegration
                ? t('common.saveChanges')
                : t('customWebhook.create')
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
