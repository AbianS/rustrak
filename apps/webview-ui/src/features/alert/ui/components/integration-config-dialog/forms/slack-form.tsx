'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  createIntegration,
  updateIntegration,
} from '@/features/alert/api/mutations';
import {
  SLACK_FIELD_MAP,
  type SlackFormData,
  type SlackMethod,
  slackDefaults,
  slackFormSchema,
} from '@/features/alert/model/integration-forms';
import { useRouter } from '@/i18n/navigation';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from '@/shared/ui/components/shadcn/form';
import { Input } from '@/shared/ui/components/shadcn/input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/ui/components/shadcn/tabs';
import { ConfigFooter } from '../fields/config-footer';
import { EnabledField } from '../fields/enabled-field';
import { NameField } from '../fields/name-field';
import type { ConfigFormProps } from '../integration-config-dialog';

export function SlackForm({
  onOpenChange,
  existingIntegration,
  onTest,
  onDelete,
  isPending: parentPending,
}: ConfigFormProps) {
  const t = useTranslations('alerts');

  const globalT = useTranslations();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || parentPending;
  const [testChannel, setTestChannel] = useState('');

  const schema = useMemo(() => slackFormSchema(t), [t]);
  const form = useForm<SlackFormData>({
    resolver: zodResolver(schema),
    defaultValues: slackDefaults(existingIntegration),
  });

  const method = form.watch('method') as SlackMethod;

  const onSubmit = (data: SlackFormData) => {
    startTransition(async () => {
      let credentials: Record<string, unknown>;

      if (data.method === 'webhook') {
        credentials = { method: 'webhook', webhook_url: data.webhook_url };
      } else {
        credentials = { method: 'bot_token' };
        const tokenEmpty = !data.token || data.token.trim() === '';
        if (!tokenEmpty) credentials.token = data.token;
      }

      const result = existingIntegration
        ? await updateIntegration(existingIntegration.id, {
            name: data.name,
            credentials,
            is_enabled: data.is_enabled,
          })
        : await createIntegration({
            name: data.name,
            provider_type: 'slack',
            credentials,
            is_enabled: data.is_enabled,
          });

      if (!result.success) {
        const applied = applyServerFieldErrors(form, result.error, {
          map: SLACK_FIELD_MAP,
          labels: {
            name: t('common.fieldName'),
            webhook_url: t('slack.fieldWebhookUrl'),
            token: t('slack.fieldToken'),
          },
          t: globalT,
        });

        if (applied.formLevel) {
          toast.error(t('slack.saveFailed'), {
            description: applied.formLevel,
          });
        }
        return;
      }

      toast.success(t(existingIntegration ? 'slack.updated' : 'slack.created'));
      onOpenChange(false);
      router.refresh();
    });
  };

  const isBotToken = method === 'bot_token';

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t(existingIntegration ? 'slack.titleEdit' : 'slack.titleNew')}
        </DialogTitle>
        <DialogDescription>{t('slack.description')}</DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <NameField<SlackFormData>
            placeholder={t('slack.namePlaceholder')}
            disabled={isLoading}
          />

          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t('slack.methodLabel')}
                </FormLabel>
                <Tabs
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as SlackMethod)}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="webhook" disabled={isLoading}>
                      {t('slack.incomingWebhook')}
                    </TabsTrigger>
                    <TabsTrigger value="bot_token" disabled={isLoading}>
                      {t('slack.botTokenTab')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="webhook" className="mt-3">
                    <FormField
                      control={form.control}
                      name="webhook_url"
                      render={({ field: urlField }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {t('slack.webhookUrlLabel')}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="url"
                              placeholder={t('slack.webhookUrlPlaceholder')}
                              disabled={isLoading}
                              {...urlField}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('slack.webhookUrlDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="bot_token" className="mt-3">
                    <FormField
                      control={form.control}
                      name="token"
                      render={({ field: tokenField }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {t('slack.botTokenTab')}
                            {existingIntegration
                              ? ` ${t('slack.tokenLabelSuffix')}`
                              : ''}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={t('slack.tokenPlaceholder')}
                              autoComplete="new-password"
                              disabled={isLoading}
                              {...tokenField}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('slack.tokenDescription')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </Tabs>
                <FormMessage />
              </FormItem>
            )}
          />

          <EnabledField<SlackFormData> disabled={isLoading} />

          {existingIntegration && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('slack.sendTestTitle')}
              </p>
              {isBotToken ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('slack.testChannelPlaceholder')}
                      value={testChannel}
                      onChange={(e) => setTestChannel(e.target.value)}
                      className="h-8 text-xs"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!testChannel.trim()) return;
                        onTest(existingIntegration, {
                          channel: testChannel.trim(),
                        });
                      }}
                      disabled={isLoading || !testChannel.trim()}
                    >
                      <Play className="size-3.5 mr-1" />
                      {t('common.test')}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t('slack.testChannelHint')}
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    {t('slack.testWebhookHint')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onTest(existingIntegration)}
                    disabled={isLoading}
                  >
                    <Play className="size-3.5 mr-1" />
                    {t('common.test')}
                  </Button>
                </div>
              )}
            </div>
          )}

          <ConfigFooter
            existingIntegration={existingIntegration}
            submitLabel={
              existingIntegration
                ? t('common.saveChanges')
                : t('slack.addIntegration')
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
