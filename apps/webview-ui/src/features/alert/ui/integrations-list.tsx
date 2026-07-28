'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AlertIntegration, ProviderType } from '@rustrak/client';
import {
  Bell,
  ChevronDown,
  Hash,
  Loader2,
  Mail,
  Play,
  Plus,
  Trash2,
  Webhook,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  createIntegration,
  deleteIntegration,
  testIntegration,
  updateIntegration,
} from '@/features/alert/api/mutations';
import {
  applyServerFieldErrors,
  type ServerFieldMap,
} from '@/shared/lib/form-errors';
import { cn } from '@/shared/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/shadcn/alert-dialog';
import { Badge } from '@/shared/ui/shadcn/badge';
import { Button } from '@/shared/ui/shadcn/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/shadcn/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/shadcn/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from '@/shared/ui/shadcn/form';
import { Input } from '@/shared/ui/shadcn/input';
import { Switch } from '@/shared/ui/shadcn/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/ui/shadcn/tabs';

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
// Server field paths -> the names these dialogs register
// ============================================================================
//
// Every one of these dialogs renders flat inputs and posts them nested inside a
// single opaque `credentials` object, so a `FieldError.field` is a dot path into
// *the request body*: `credentials.webhook_url`, never `webhook_url`. Without
// these maps the path matches no registered name and the message falls back to
// the form-level slot, which is safe but strictly less useful than marking the
// input the user has to fix. `name` and `is_enabled` are genuine top-level body
// keys and need no entry.

const WEBHOOK_FIELD_MAP: ServerFieldMap = {
  'credentials.url': 'url',
  'credentials.secret': 'secret',
};

const SLACK_FIELD_MAP: ServerFieldMap = {
  'credentials.webhook_url': 'webhook_url',
  'credentials.token': 'token',
};

const EMAIL_FIELD_MAP: ServerFieldMap = {
  'credentials.smtp_host': 'smtp_host',
  'credentials.smtp_port': 'smtp_port',
  'credentials.smtp_username': 'smtp_username',
  'credentials.smtp_password': 'smtp_password',
  'credentials.from_address': 'from_address',
};

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
  const [manageType, setManageType] = useState<ProviderType | null>(null);
  const [editIntegration, setEditIntegration] =
    useState<AlertIntegration | null>(null);
  const [deleteIntegrationItem, setDeleteIntegrationItem] =
    useState<AlertIntegration | null>(null);

  const getIntegrationsByType = (type: ProviderType) =>
    initialIntegrations.filter((c) => c.provider_type === type);

  const handleTest = (
    integration: AlertIntegration,
    routingOverride?: Record<string, unknown>,
  ) => {
    startTransition(async () => {
      const result = await testIntegration(integration.id, routingOverride);

      if (!result.success) {
        // The request itself failed. Distinct from the delivery result below,
        // which is a successful request reporting that the provider refused.
        toast.error('Failed to send test', {
          description: result.error.message,
        });
        return;
      }

      if (result.data.success) {
        toast.success('Test notification sent', {
          description: result.data.message,
        });
      } else {
        toast.error('Test failed', { description: result.data.message });
      }
    });
  };

  const handleDelete = () => {
    if (!deleteIntegrationItem) return;
    startTransition(async () => {
      const result = await deleteIntegration(deleteIntegrationItem.id);

      if (!result.success) {
        toast.error('Failed to delete integration', {
          description: result.error.message,
        });
        return;
      }

      toast.success('Integration deleted');
      const remaining = initialIntegrations.filter(
        (i) =>
          i.provider_type === deleteIntegrationItem.provider_type &&
          i.id !== deleteIntegrationItem.id,
      );
      if (remaining.length === 0) setManageType(null);
      setDeleteIntegrationItem(null);
      setConfigureType(null);
      setEditIntegration(null);
      router.refresh();
    });
  };

  const handleCardClick = (type: ProviderType) => {
    const instances = getIntegrationsByType(type);
    if (instances.length >= 1) {
      setManageType(type);
    } else {
      setEditIntegration(null);
      setConfigureType(type);
    }
  };

  const handleEditFromManage = (integration: AlertIntegration) => {
    setManageType(null);
    setEditIntegration(integration);
    setConfigureType(integration.provider_type);
  };

  const handleAddFromManage = (type: ProviderType) => {
    setManageType(null);
    setEditIntegration(null);
    setConfigureType(type);
  };

  const closeConfigure = () => {
    setConfigureType(null);
    setEditIntegration(null);
  };

  const alertConfiguredCount = alertProviders.filter(
    (p) => getIntegrationsByType(p.type).length > 0,
  ).length;

  return (
    <div className="space-y-3">
      <Collapsible defaultOpen className="group/section">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3.5 transition-colors hover:bg-accent/50 group-data-open/section:rounded-b-none group-data-open/section:border-b-0">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-md bg-orange-500/10 text-orange-500">
                <Bell className="size-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold leading-none">
                  Alert Notifications
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Send alerts to external services when new issues are detected.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {alertConfiguredCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  {alertConfiguredCount} configured
                </Badge>
              )}
              <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-data-open/section:rotate-180" />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="rounded-b-lg border border-t-0 bg-card/50 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {alertProviders.map((providerDef) => {
              const instances = getIntegrationsByType(providerDef.type);
              const Icon = providerDef.icon;
              const count = instances.length;
              const single = count === 1 ? instances[0] : null;
              const isConnected = !!single && single.is_enabled;
              const isDisabled = !!single && !single.is_enabled;

              return (
                <div
                  key={providerDef.type}
                  className={cn(
                    'group relative bg-card border rounded-lg p-5 flex flex-col justify-between h-48',
                    'hover:border-primary/50 transition-all cursor-pointer',
                    count === 0 && 'opacity-70 hover:opacity-100',
                  )}
                  onClick={() => handleCardClick(providerDef.type)}
                >
                  <div className="flex justify-between items-start">
                    <div
                      className={cn(
                        'size-10 rounded flex items-center justify-center text-white',
                        providerDef.color,
                      )}
                    >
                      <Icon className="size-5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={isConnected ? 'default' : 'secondary'}
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-wider',
                          isConnected &&
                            'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20',
                          isDisabled && 'opacity-60',
                        )}
                      >
                        {count === 0
                          ? 'Not configured'
                          : count > 1
                            ? `${count} configured`
                            : isConnected
                              ? 'Connected'
                              : 'Disabled'}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-base">{providerDef.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {single ? single.name : providerDef.description}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full text-xs font-bold uppercase tracking-wide"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick(providerDef.type);
                    }}
                  >
                    {count === 0 ? 'Configure' : 'Manage'}
                  </Button>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Manage dialog — shown when 1+ instances exist */}
      {alertProviders.map((providerDef) => {
        const instances = getIntegrationsByType(providerDef.type);
        return (
          <ManageDialog
            key={providerDef.type}
            open={manageType === providerDef.type}
            onOpenChange={(open) => !open && setManageType(null)}
            providerDef={providerDef}
            instances={instances}
            onEdit={handleEditFromManage}
            onAdd={() => handleAddFromManage(providerDef.type)}
            onDelete={(i) => setDeleteIntegrationItem(i)}
          />
        );
      })}

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
        // Must forward routingOverride — Email carries its recipients there.
        onTest={handleTest}
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
// ManageDialog — shown when a provider has 1+ configured instances
// ============================================================================

interface ManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerDef: (typeof alertProviders)[number];
  instances: AlertIntegration[];
  onEdit: (integration: AlertIntegration) => void;
  onAdd: () => void;
  onDelete: (integration: AlertIntegration) => void;
}

function ManageDialog({
  open,
  onOpenChange,
  providerDef,
  instances,
  onEdit,
  onAdd,
  onDelete,
}: ManageDialogProps) {
  const Icon = providerDef.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'size-9 rounded flex items-center justify-center text-white shrink-0',
                providerDef.color,
              )}
            >
              <Icon className="size-4.5" />
            </div>
            <div>
              <DialogTitle>{providerDef.name}</DialogTitle>
              <DialogDescription>
                {instances.length} integration
                {instances.length !== 1 ? 's' : ''} configured
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {instances.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={cn(
                    'size-2 rounded-full shrink-0',
                    integration.is_enabled
                      ? 'bg-green-500'
                      : 'bg-muted-foreground/40',
                  )}
                />
                <span className="text-sm font-medium truncate">
                  {integration.name}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onEdit(integration)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  aria-label={`Delete ${integration.name}`}
                  className="h-7 w-7 p-0"
                  onClick={() => onDelete(integration)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onAdd}>
            <Plus className="size-4 mr-1.5" />
            Add {providerDef.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(existingIntegration)}
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
            {/* Where a failure that named no field of this dialog lands. */}
            <FormRootError />
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
                      placeholder="e.g., Engineering Alerts"
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
                              OAuth bot token starting with xoxb- from your
                              Slack app.
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
                      Enter the Slack channel where the test message will be
                      sent.
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

            <DialogFooter className="gap-2 sm:gap-0">
              {existingIntegration && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(existingIntegration)}
                  disabled={isLoading}
                >
                  <Trash2 className="size-4 mr-1" />
                  Delete
                </Button>
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
                {existingIntegration ? 'Save Changes' : 'Add Integration'}
              </Button>
            </DialogFooter>
            {/* Where a failure that named no field of this dialog lands. */}
            <FormRootError />
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

            <DialogFooter className="gap-2 sm:gap-0">
              {existingIntegration && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(existingIntegration)}
                  disabled={isLoading}
                >
                  <Trash2 className="size-4 mr-1" />
                  Delete
                </Button>
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
            {/* Where a failure that named no field of this dialog lands. */}
            <FormRootError />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
