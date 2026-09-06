'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { previewTemplate } from '@/features/alert/api/mutations';
import { filledCredentials } from '@/features/alert/lib/credentials';
import { formatTemplate } from '@/features/alert/lib/format-template';
import {
  CUSTOM_WEBHOOK_FIELD_MAP,
  type CustomWebhookFormData,
  customWebhookDefaults,
  customWebhookFormSchema,
} from '@/features/alert/model/integration-forms';
import {
  TEMPLATE_DOCS_URL,
  TEMPLATE_VARIABLES,
  templatePlaceholder,
} from '@/features/alert/model/message-template';
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

/**
 * The editor is the heaviest thing in the dashboard, and it exists for one
 * field of one provider's dialog. Loaded on demand, that weight is paid by the
 * person who opens this dialog rather than by everyone who visits the
 * integrations page. `ssr: false` because CodeMirror builds against the DOM
 * and has nothing to render on the server.
 */
const JsonTemplateEditor = dynamic(
  () =>
    import('@/features/alert/ui/components/json-template-editor').then(
      (module) => module.JsonTemplateEditor,
    ),
  {
    ssr: false,
    // Same height and frame as the editor, so the dialog does not jump when
    // the chunk lands.
    loading: () => (
      <div className="h-[calc(7rem+2.25rem)] animate-pulse rounded-md border border-input bg-muted/30" />
    ),
  },
);

/**
 * Why the body would be refused, or `null`. The editor asks while the reader
 * types and marks the spot itself; the server answers because it owns the
 * template engine, and a check computed anywhere else would eventually
 * disagree with what a save accepts.
 */
async function validateTemplate(template: string) {
  const result = await previewTemplate(template);
  if (!result.success) return null;
  return result.data.ok ? null : (result.data.error ?? null);
}

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
      }),
    fieldMap: CUSTOM_WEBHOOK_FIELD_MAP,
    labels: {
      name: t('common.fieldName'),
      url: t('webhook.fieldUrl'),
      secret: t('webhook.fieldSecret'),
      template: t('customWebhook.fieldTemplate'),
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

  // An integration that is being edited already has a body, and the reader
  // should see what it renders to without having to touch it first. One
  // request on mount, not a subscription to the field.
  useEffect(() => {
    // A stored body was saved as one line; nobody writes JSON that way, so it
    // arrives indented the way they would have written it.
    const stored = form.getValues('template');
    const indented = formatTemplate(stored);
    if (indented !== stored) form.setValue('template', indented);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTemplate = (template: string) => {
    form.setValue('template', template, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <>
      <DialogHeader className="shrink-0 border-b px-6 pt-6 pr-14 pb-4">
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
        <form
          onSubmit={form.handleSubmit(submit)}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* The only part that scrolls, so the title and the actions stay
              on screen however long the message body gets. */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <NameField<CustomWebhookFormData>
              placeholder={t('customWebhook.namePlaceholder')}
              disabled={isLoading}
            />

            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('customWebhook.urlLabel')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder={t('customWebhook.urlPlaceholder')}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('customWebhook.urlDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="template"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('customWebhook.templateLabel')}
                  </FormLabel>
                  <FormControl>
                    <JsonTemplateEditor
                      value={field.value}
                      onChange={setTemplate}
                      onBlur={field.onBlur}
                      onFormat={() => setTemplate(formatTemplate(field.value))}
                      validate={validateTemplate}
                      disabled={isLoading}
                      placeholder={templatePlaceholder}
                      variables={TEMPLATE_VARIABLES}
                      ariaLabel={t('customWebhook.templateLabel')}
                      label={t('customWebhook.editorLabel')}
                      helpHref={TEMPLATE_DOCS_URL}
                      formatLabel={t('customWebhook.format')}
                      helpLabel={t('customWebhook.help')}
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
              name="secret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t('customWebhook.secretLabel')}
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
                    {t('customWebhook.secretDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <EnabledField<CustomWebhookFormData> disabled={isLoading} />
          </div>

          {/* Outside the scroll area: a failure that named no field of this
              dialog has to be visible wherever the reader has scrolled to. */}
          <div className="shrink-0 border-t px-6 py-4">
            <FormRootError />
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
          </div>
        </form>
      </Form>
    </>
  );
}
