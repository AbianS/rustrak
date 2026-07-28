'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || parentPending;
  const [testChannel, setTestChannel] = useState('');

  const form = useForm<SlackFormData>({
    resolver: zodResolver(slackFormSchema),
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
            name: 'That name',
            webhook_url: 'That webhook URL',
            token: 'That bot token',
          },
        });

        if (applied.formLevel) {
          toast.error('Failed to save Slack integration', {
            description: applied.formLevel,
          });
        }
        return;
      }

      toast.success(
        existingIntegration
          ? 'Slack integration updated'
          : 'Slack integration created',
      );
      onOpenChange(false);
      router.refresh();
    });
  };

  const isBotToken = method === 'bot_token';

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {existingIntegration
            ? 'Edit Slack Integration'
            : 'Add Slack Integration'}
        </DialogTitle>
        <DialogDescription>
          Store your Slack credentials here. Choose the target channel when
          creating an alert rule.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <NameField<SlackFormData>
            placeholder="e.g., Team Alerts"
            disabled={isLoading}
          />

          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Connection method
                </FormLabel>
                <Tabs
                  value={field.value}
                  onValueChange={(v) => field.onChange(v as SlackMethod)}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="webhook" disabled={isLoading}>
                      Incoming Webhook
                    </TabsTrigger>
                    <TabsTrigger value="bot_token" disabled={isLoading}>
                      Bot Token
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="webhook" className="mt-3">
                    <FormField
                      control={form.control}
                      name="webhook_url"
                      render={({ field: urlField }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Webhook URL
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="url"
                              placeholder="https://hooks.slack.com/services/..."
                              disabled={isLoading}
                              {...urlField}
                            />
                          </FormControl>
                          <FormDescription>
                            Create an incoming webhook in your Slack app
                            settings.
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
                            Bot Token
                            {existingIntegration
                              ? ' (leave blank to keep existing)'
                              : ''}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="xoxb-..."
                              autoComplete="new-password"
                              disabled={isLoading}
                              {...tokenField}
                            />
                          </FormControl>
                          <FormDescription>
                            OAuth bot token starting with xoxb- from your Slack
                            app.
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
                Send a test
              </p>
              {isBotToken ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="#alerts"
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
                      Test
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Enter the Slack channel where the test message will be sent.
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    Sends a test message to the configured webhook.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onTest(existingIntegration)}
                    disabled={isLoading}
                  >
                    <Play className="size-3.5 mr-1" />
                    Test
                  </Button>
                </div>
              )}
            </div>
          )}

          <ConfigFooter
            existingIntegration={existingIntegration}
            submitLabel={
              existingIntegration ? 'Save Changes' : 'Add Integration'
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
