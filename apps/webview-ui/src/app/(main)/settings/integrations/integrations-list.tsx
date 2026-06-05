'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AlertIntegration, ProviderType } from '@rustrak/client';
import { Hash, Loader2, Mail, Play, Trash2, Webhook } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  createIntegration,
  deleteIntegration,
  testIntegration,
  updateIntegration,
} from '@/actions/alerts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// Active alert notification providers
const alertProviders = [
  {
    type: 'slack' as const,
    name: 'Slack',
    description: 'Send alerts to Slack channels via webhook or bot token.',
    icon: Hash,
    color: 'bg-[#4A154B]',
  },
  {
    type: 'email' as const,
    name: 'Email',
    description: 'Send alerts via SMTP email to any recipient.',
    icon: Mail,
    color: 'bg-[#0066CC]',
  },
  {
    type: 'webhook' as const,
    name: 'Webhook',
    description: 'POST JSON payloads to any HTTP endpoint.',
    icon: Webhook,
    color: 'bg-orange-600',
  },
];

// ============================================================================
// Form Schemas — credentials only, no routing fields
// ============================================================================

const webhookFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  // url is optional: per-rule routing_override.url can supply it
  url: z
    .string()
    .optional()
    .refine(
      (v) =>
        !v ||
        v.trim() === '' ||
        v.startsWith('http://') ||
        v.startsWith('https://'),
      { message: 'Must be a valid http/https URL' },
    ),
  secret: z.string().optional(),
  is_enabled: z.boolean(),
});

const slackFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    method: z.enum(['webhook', 'bot_token']),
    is_edit: z.boolean(),
    webhook_url: z.string().optional(),
    token: z.string().optional(),
    is_enabled: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.method === 'webhook') {
      if (!data.webhook_url || data.webhook_url.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Webhook URL is required',
          path: ['webhook_url'],
        });
      } else {
        try {
          const url = new URL(data.webhook_url);
          if (url.protocol !== 'https:' || url.hostname !== 'hooks.slack.com') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                'Must be a valid Slack webhook URL (https://hooks.slack.com/...)',
              path: ['webhook_url'],
            });
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please enter a valid URL',
            path: ['webhook_url'],
          });
        }
      }
    } else if (data.method === 'bot_token') {
      const tokenEmpty = !data.token || data.token.trim() === '';
      if (data.is_edit && tokenEmpty) {
        // Blank on edit = keep existing — OK
        return;
      }
      if (tokenEmpty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bot token is required',
          path: ['token'],
        });
      } else if (!data.token!.startsWith('xoxb-')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bot token must start with xoxb-',
          path: ['token'],
        });
      }
    }
  });

const emailFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  smtp_host: z.string().min(1, 'SMTP host is required'),
  smtp_port: z.number().int().min(1).max(65535),
  smtp_username: z.string().optional(),
  smtp_password: z.string().optional(),
  from_address: z.string().email('Please enter a valid email'),
  is_enabled: z.boolean(),
});

type WebhookFormData = z.infer<typeof webhookFormSchema>;
type SlackFormData = z.infer<typeof slackFormSchema>;
type EmailFormData = z.infer<typeof emailFormSchema>;
type SlackMethod = 'webhook' | 'bot_token';

interface IntegrationsListProps {
  initialIntegrations: AlertIntegration[];
}

export function IntegrationsList({
  initialIntegrations,
}: IntegrationsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [configureType, setConfigureType] = useState<ProviderType | null>(null);
  const [editIntegration, setEditIntegration] =
    useState<AlertIntegration | null>(null);
  const [deleteIntegrationItem, setDeleteIntegrationItem] =
    useState<AlertIntegration | null>(null);

  const getIntegrationByType = (type: ProviderType) =>
    initialIntegrations.find((c) => c.provider_type === type);

  const handleTest = (
    integration: AlertIntegration,
    routingOverride?: Record<string, unknown>,
  ) => {
    startTransition(async () => {
      try {
        const result = await testIntegration(integration.id, routingOverride);
        if (result.success) {
          toast.success('Test notification sent', {
            description: result.message,
          });
        } else {
          toast.error('Test failed', { description: result.message });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to send test';
        toast.error('Failed to send test', { description: message });
      }
    });
  };

  const handleDelete = () => {
    if (!deleteIntegrationItem) return;
    startTransition(async () => {
      try {
        await deleteIntegration(deleteIntegrationItem.id);
        toast.success('Integration deleted');
        setDeleteIntegrationItem(null);
        setConfigureType(null);
        setEditIntegration(null);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete';
        toast.error('Failed to delete integration', { description: message });
      }
    });
  };

  const openConfigure = (type: ProviderType) => {
    const existing = getIntegrationByType(type);
    if (existing) setEditIntegration(existing);
    setConfigureType(type);
  };

  const closeConfigure = () => {
    setConfigureType(null);
    setEditIntegration(null);
  };

  return (
    <div className="space-y-10">
      {/* Alert Notifications */}
      <section>
        <div className="mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Alert Notifications
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Get notified when issues occur in your projects.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {alertProviders.map((providerDef) => {
            const existing = getIntegrationByType(providerDef.type);
            const Icon = providerDef.icon;
            const isConnected = !!existing && existing.is_enabled;
            const isDisabled = !!existing && !existing.is_enabled;

            return (
              <button
                key={providerDef.type}
                type="button"
                className={cn(
                  'group bg-card border rounded-xl p-5 flex flex-col gap-4 text-left transition-all',
                  'hover:border-primary/40 hover:shadow-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                onClick={() => openConfigure(providerDef.type)}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      'size-10 rounded-lg flex items-center justify-center text-white shrink-0',
                      providerDef.color,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <Badge
                    variant={isConnected ? 'default' : 'secondary'}
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider',
                      isConnected &&
                        'bg-green-500/10 text-green-600 border-green-500/20',
                      isDisabled && 'opacity-60',
                    )}
                  >
                    {isConnected
                      ? 'Connected'
                      : isDisabled
                        ? 'Disabled'
                        : 'Not configured'}
                  </Badge>
                </div>

                <div className="flex-1 min-h-0">
                  <p className="font-semibold text-sm">{providerDef.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {existing ? existing.name : providerDef.description}
                  </p>
                </div>

                <p className="text-xs font-semibold text-primary group-hover:underline">
                  {existing ? 'Edit configuration →' : 'Configure →'}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <WebhookConfigDialog
        open={configureType === 'webhook'}
        onOpenChange={(open) => !open && closeConfigure()}
        existingIntegration={editIntegration}
        onTest={(integration) => handleTest(integration)}
        onDelete={(integration) => setDeleteIntegrationItem(integration)}
        isPending={isPending}
      />

      <SlackConfigDialog
        open={configureType === 'slack'}
        onOpenChange={(open) => !open && closeConfigure()}
        existingIntegration={editIntegration}
        onTest={handleTest}
        onDelete={(integration) => setDeleteIntegrationItem(integration)}
        isPending={isPending}
      />

      <EmailConfigDialog
        open={configureType === 'email'}
        onOpenChange={(open) => !open && closeConfigure()}
        existingIntegration={editIntegration}
        onTest={(integration) => handleTest(integration)}
        onDelete={(integration) => setDeleteIntegrationItem(integration)}
        isPending={isPending}
      />

      <AlertDialog
        open={!!deleteIntegrationItem}
        onOpenChange={(open) => !open && setDeleteIntegrationItem(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Integration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {deleteIntegrationItem?.name}&quot;? This action cannot be undone
              and will stop all alerts using this integration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Shared dialog props
// ============================================================================

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingIntegration: AlertIntegration | null;
  onTest: (
    integration: AlertIntegration,
    routingOverride?: Record<string, unknown>,
  ) => void;
  onDelete: (integration: AlertIntegration) => void;
  isPending: boolean;
}

// ============================================================================
// Webhook Configuration Dialog
// ============================================================================

function WebhookConfigDialog({
  open,
  onOpenChange,
  existingIntegration,
  onTest,
  onDelete,
  isPending: parentPending,
}: ConfigDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || parentPending;

  const form = useForm<WebhookFormData>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: { name: '', url: '', secret: '', is_enabled: true },
  });

  useEffect(() => {
    if (open && existingIntegration) {
      const creds = existingIntegration.credentials as {
        url?: string;
        secret?: string;
      };
      form.reset({
        name: existingIntegration.name,
        url: creds.url ?? '',
        secret: creds.secret ?? '',
        is_enabled: existingIntegration.is_enabled,
      });
    } else if (open) {
      form.reset({ name: '', url: '', secret: '', is_enabled: true });
    }
  }, [open, existingIntegration, form]);

  const onSubmit = (data: WebhookFormData) => {
    startTransition(async () => {
      try {
        const credentials: Record<string, unknown> = {};
        if (data.url && data.url.trim() !== '') credentials.url = data.url;
        if (data.secret && data.secret.trim() !== '')
          credentials.secret = data.secret;

        if (existingIntegration) {
          await updateIntegration(existingIntegration.id, {
            name: data.name,
            credentials,
            is_enabled: data.is_enabled,
          });
          toast.success('Webhook updated');
        } else {
          await createIntegration({
            name: data.name,
            provider_type: 'webhook',
            credentials,
            is_enabled: data.is_enabled,
          });
          toast.success('Webhook created');
        }
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save webhook';
        toast.error('Failed to save webhook', { description: message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Production Alerts"
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

            <FormField
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">
                      Enabled
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Receive alerts on this integration
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              {existingIntegration && (
                <div className="flex gap-2 mr-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onTest(existingIntegration)}
                    disabled={isLoading}
                  >
                    <Play className="size-4 mr-1" />
                    Test
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(existingIntegration)}
                    disabled={isLoading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
                {existingIntegration ? 'Save Changes' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Slack Configuration Dialog
// ============================================================================

function SlackConfigDialog({
  open,
  onOpenChange,
  existingIntegration,
  onTest,
  onDelete,
  isPending: parentPending,
}: ConfigDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || parentPending;
  const [testChannel, setTestChannel] = useState('');

  const form = useForm<SlackFormData>({
    resolver: zodResolver(slackFormSchema),
    defaultValues: {
      name: '',
      method: 'webhook',
      is_edit: false,
      webhook_url: '',
      token: '',
      is_enabled: true,
    },
  });

  const method = form.watch('method') as SlackMethod;

  useEffect(() => {
    if (open && existingIntegration) {
      const creds = existingIntegration.credentials as {
        method?: SlackMethod;
        webhook_url?: string;
      };
      form.reset({
        name: existingIntegration.name,
        method: creds.method ?? 'webhook',
        is_edit: true,
        webhook_url: creds.webhook_url ?? '',
        token: '',
        is_enabled: existingIntegration.is_enabled,
      });
    } else if (open) {
      form.reset({
        name: '',
        method: 'webhook',
        is_edit: false,
        webhook_url: '',
        token: '',
        is_enabled: true,
      });
    }
    setTestChannel('');
  }, [open, existingIntegration, form]);

  const onSubmit = (data: SlackFormData) => {
    startTransition(async () => {
      try {
        let credentials: Record<string, unknown>;

        if (data.method === 'webhook') {
          credentials = { method: 'webhook', webhook_url: data.webhook_url };
        } else {
          credentials = { method: 'bot_token' };
          const tokenEmpty = !data.token || data.token.trim() === '';
          if (!tokenEmpty) credentials.token = data.token;
        }

        if (existingIntegration) {
          await updateIntegration(existingIntegration.id, {
            name: data.name,
            credentials,
            is_enabled: data.is_enabled,
          });
          toast.success('Slack integration updated');
        } else {
          await createIntegration({
            name: data.name,
            provider_type: 'slack',
            credentials,
            is_enabled: data.is_enabled,
          });
          toast.success('Slack integration created');
        }
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to save Slack integration';
        toast.error('Failed to save Slack integration', {
          description: message,
        });
      }
    });
  };

  const isBotToken = method === 'bot_token';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existingIntegration ? 'Edit Slack Integration' : 'Configure Slack'}
          </DialogTitle>
          <DialogDescription>
            Store Slack credentials here. Choose the target channel when
            creating an alert rule.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Slack Alerts"
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
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Delivery Method
                  </FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => field.onChange('webhook')}
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm text-left transition-colors',
                        field.value === 'webhook'
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-muted-foreground/30 hover:border-primary/50',
                      )}
                    >
                      <div className="font-medium">Incoming Webhook</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Paste a webhook URL
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => field.onChange('bot_token')}
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm text-left transition-colors',
                        field.value === 'bot_token'
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-muted-foreground/30 hover:border-primary/50',
                      )}
                    >
                      <div className="font-medium">Bot Token</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Use an xoxb- bot token
                      </div>
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {method === 'webhook' && (
              <FormField
                control={form.control}
                name="webhook_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Webhook URL
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="url"
                        placeholder="https://hooks.slack.com/services/..."
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Create an incoming webhook in your Slack app settings
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {method === 'bot_token' && (
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
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
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      OAuth bot token starting with xoxb- from your Slack app
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">
                      Enabled
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Receive alerts on this integration
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              {existingIntegration && (
                <div className="flex gap-2 mr-auto">
                  {isBotToken ? (
                    // Inline channel input for bot_token test
                    <div className="flex gap-1 items-center">
                      <Input
                        placeholder="#alerts"
                        value={testChannel}
                        onChange={(e) => setTestChannel(e.target.value)}
                        className="h-8 w-28 text-xs"
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
                        <Play className="size-4 mr-1" />
                        Test
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onTest(existingIntegration)}
                      disabled={isLoading}
                    >
                      <Play className="size-4 mr-1" />
                      Test
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(existingIntegration)}
                    disabled={isLoading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
                {existingIntegration
                  ? 'Save Changes'
                  : 'Create Slack Integration'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Email Configuration Dialog — credentials only (no recipients)
// ============================================================================

function EmailConfigDialog({
  open,
  onOpenChange,
  existingIntegration,
  onTest,
  onDelete,
  isPending: parentPending,
}: ConfigDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || parentPending;
  const [testRecipients, setTestRecipients] = useState('');

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      name: '',
      smtp_host: '',
      smtp_port: 587,
      smtp_username: '',
      smtp_password: '',
      from_address: '',
      is_enabled: true,
    },
  });

  useEffect(() => {
    if (open && existingIntegration) {
      const creds = existingIntegration.credentials as {
        smtp_host?: string;
        smtp_port?: number;
        smtp_username?: string;
        from_address?: string;
      };
      form.reset({
        name: existingIntegration.name,
        smtp_host: creds.smtp_host ?? '',
        smtp_port: creds.smtp_port ?? 587,
        smtp_username: creds.smtp_username ?? '',
        smtp_password: '',
        from_address: creds.from_address ?? '',
        is_enabled: existingIntegration.is_enabled,
      });
    } else if (open) {
      form.reset({
        name: '',
        smtp_host: '',
        smtp_port: 587,
        smtp_username: '',
        smtp_password: '',
        from_address: '',
        is_enabled: true,
      });
    }
    setTestRecipients('');
  }, [open, existingIntegration, form]);

  const onSubmit = (data: EmailFormData) => {
    startTransition(async () => {
      try {
        const credentials: Record<string, unknown> = {
          smtp_host: data.smtp_host,
          smtp_port: data.smtp_port,
          from_address: data.from_address,
        };
        if (data.smtp_username) credentials.smtp_username = data.smtp_username;
        if (data.smtp_password) credentials.smtp_password = data.smtp_password;

        if (existingIntegration) {
          await updateIntegration(existingIntegration.id, {
            name: data.name,
            credentials,
            is_enabled: data.is_enabled,
          });
          toast.success('Email integration updated');
        } else {
          await createIntegration({
            name: data.name,
            provider_type: 'email',
            credentials,
            is_enabled: data.is_enabled,
          });
          toast.success('Email integration created');
        }
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to save email integration';
        toast.error('Failed to save email integration', {
          description: message,
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingIntegration
              ? 'Edit Email Integration'
              : 'Configure Email (SMTP)'}
          </DialogTitle>
          <DialogDescription>
            Store SMTP credentials here. Specify recipients when creating an
            alert rule.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Email Alerts"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
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

            <FormField
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">
                      Enabled
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Receive alerts on this integration
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isLoading}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              {existingIntegration && (
                <div className="flex gap-2 mr-auto">
                  <div className="flex gap-1 items-center">
                    <Input
                      placeholder="test@example.com"
                      value={testRecipients}
                      onChange={(e) => setTestRecipients(e.target.value)}
                      className="h-8 w-36 text-xs"
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!testRecipients.trim()) return;
                        const recipients = testRecipients
                          .split(',')
                          .map((a) => a.trim())
                          .filter(Boolean);
                        onTest(existingIntegration, { recipients });
                      }}
                      disabled={isLoading || !testRecipients.trim()}
                    >
                      <Play className="size-4 mr-1" />
                      Test
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(existingIntegration)}
                    disabled={isLoading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
                {existingIntegration
                  ? 'Save Changes'
                  : 'Create Email Integration'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
