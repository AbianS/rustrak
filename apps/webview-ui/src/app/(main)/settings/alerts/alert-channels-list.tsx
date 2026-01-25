'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ChannelType, NotificationChannel } from '@rustrak/client';
import { Hash, Loader2, Mail, Play, Trash2, Webhook } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  createNotificationChannel,
  deleteNotificationChannel,
  testNotificationChannel,
  updateNotificationChannel,
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

// Channel type definitions
const channelTypes = [
  {
    type: 'slack' as const,
    name: 'Slack',
    description: 'Send alerts to Slack channels.',
    icon: Hash,
    color: 'bg-[#4A154B]',
  },
  {
    type: 'email' as const,
    name: 'Email (SMTP)',
    description: 'Send alerts via email.',
    icon: Mail,
    color: 'bg-[#0066CC]',
  },
  {
    type: 'webhook' as const,
    name: 'Webhooks',
    description: 'POST payloads to external APIs.',
    icon: Webhook,
    color: 'bg-orange-600',
  },
];

// Form schemas for each channel type
const webhookFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  url: z.string().url('Please enter a valid URL'),
  secret: z.string().optional(),
  is_enabled: z.boolean(),
});

const slackFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  webhook_url: z
    .string()
    .url('Please enter a valid URL')
    .refine((value) => {
      try {
        const url = new URL(value);
        // Validate exact hostname to prevent bypass via subdomains
        // e.g., hooks.slack.com.evil.com would fail
        return url.protocol === 'https:' && url.hostname === 'hooks.slack.com';
      } catch {
        return false;
      }
    }, 'Must be a valid Slack webhook URL (https://hooks.slack.com/...)'),
  channel: z.string().optional(),
  is_enabled: z.boolean(),
});

// Helper schema for email validation
const emailAddressRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emailFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  recipients: z
    .string()
    .min(1, 'At least one recipient is required')
    .refine((value) => {
      const emails = value
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      return (
        emails.length > 0 &&
        emails.every((email) => emailAddressRegex.test(email))
      );
    }, 'Please provide valid comma-separated email addresses'),
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

interface AlertChannelsListProps {
  initialChannels: NotificationChannel[];
}

export function AlertChannelsList({ initialChannels }: AlertChannelsListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [configureType, setConfigureType] = useState<ChannelType | null>(null);
  const [editChannel, setEditChannel] = useState<NotificationChannel | null>(
    null,
  );
  const [deleteChannel, setDeleteChannel] =
    useState<NotificationChannel | null>(null);

  // Get channel by type
  const getChannelByType = (type: ChannelType) =>
    initialChannels.find((c) => c.channel_type === type);

  // Handle test channel
  const handleTest = (channel: NotificationChannel) => {
    startTransition(async () => {
      try {
        const result = await testNotificationChannel(channel.id);
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

  // Handle delete channel
  const handleDelete = () => {
    if (!deleteChannel) return;

    startTransition(async () => {
      try {
        await deleteNotificationChannel(deleteChannel.id);
        toast.success('Channel deleted');
        setDeleteChannel(null);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete channel';
        toast.error('Failed to delete channel', { description: message });
      }
    });
  };

  // Open configure dialog
  const openConfigure = (type: ChannelType) => {
    const existing = getChannelByType(type);
    if (existing) {
      setEditChannel(existing);
    }
    setConfigureType(type);
  };

  // Close configure dialog
  const closeConfigure = () => {
    setConfigureType(null);
    setEditChannel(null);
  };

  return (
    <div className="space-y-6">
      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {channelTypes.map((channelDef) => {
          const existing = getChannelByType(channelDef.type);
          const Icon = channelDef.icon;
          const isConnected = !!existing && existing.is_enabled;

          return (
            <div
              key={channelDef.type}
              className={cn(
                'group relative bg-card border rounded-lg p-5 flex flex-col justify-between h-48',
                'hover:border-primary/50 transition-all cursor-pointer',
                !existing && 'opacity-70 hover:opacity-100',
              )}
              onClick={() => openConfigure(channelDef.type)}
            >
              <div className="flex justify-between items-start">
                <div
                  className={cn(
                    'size-10 rounded flex items-center justify-center text-white',
                    channelDef.color,
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <Badge
                  variant={isConnected ? 'default' : 'secondary'}
                  className={cn(
                    'text-[10px] font-bold uppercase tracking-wider',
                    isConnected &&
                      'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20',
                  )}
                >
                  {isConnected ? 'Connected' : 'Not Configured'}
                </Badge>
              </div>

              <div>
                <h3 className="font-bold text-base">{channelDef.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {existing ? `${existing.name}` : channelDef.description}
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full text-xs font-bold uppercase tracking-wide"
                onClick={(e) => {
                  e.stopPropagation();
                  openConfigure(channelDef.type);
                }}
              >
                Configure
              </Button>
            </div>
          );
        })}
      </div>

      {/* Webhook Configuration Dialog */}
      <WebhookConfigDialog
        open={configureType === 'webhook'}
        onOpenChange={(open) => !open && closeConfigure()}
        existingChannel={editChannel}
        onTest={handleTest}
        onDelete={(channel) => setDeleteChannel(channel)}
        isPending={isPending}
      />

      {/* Slack Configuration Dialog */}
      <SlackConfigDialog
        open={configureType === 'slack'}
        onOpenChange={(open) => !open && closeConfigure()}
        existingChannel={editChannel}
        onTest={handleTest}
        onDelete={(channel) => setDeleteChannel(channel)}
        isPending={isPending}
      />

      {/* Email Configuration Dialog */}
      <EmailConfigDialog
        open={configureType === 'email'}
        onOpenChange={(open) => !open && closeConfigure()}
        existingChannel={editChannel}
        onTest={handleTest}
        onDelete={(channel) => setDeleteChannel(channel)}
        isPending={isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteChannel}
        onOpenChange={(open) => !open && setDeleteChannel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteChannel?.name}&quot;?
              This action cannot be undone and will stop all alerts to this
              destination.
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
// Webhook Configuration Dialog
// ============================================================================

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingChannel: NotificationChannel | null;
  onTest: (channel: NotificationChannel) => void;
  onDelete: (channel: NotificationChannel) => void;
  isPending: boolean;
}

function WebhookConfigDialog({
  open,
  onOpenChange,
  existingChannel,
  onTest,
  onDelete,
  isPending: parentPending,
}: ConfigDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || parentPending;

  const form = useForm<WebhookFormData>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: {
      name: '',
      url: '',
      secret: '',
      is_enabled: true,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open && existingChannel) {
      const config = existingChannel.config as {
        url?: string;
        secret?: string;
      };
      form.reset({
        name: existingChannel.name,
        url: config.url ?? '',
        secret: config.secret ?? '',
        is_enabled: existingChannel.is_enabled,
      });
    } else if (open) {
      form.reset({
        name: '',
        url: '',
        secret: '',
        is_enabled: true,
      });
    }
  }, [open, existingChannel, form]);

  const onSubmit = (data: WebhookFormData) => {
    startTransition(async () => {
      try {
        const config: Record<string, unknown> = { url: data.url };
        if (data.secret) {
          config.secret = data.secret;
        }

        if (existingChannel) {
          await updateNotificationChannel(existingChannel.id, {
            name: data.name,
            config,
            is_enabled: data.is_enabled,
          });
          toast.success('Webhook updated');
        } else {
          await createNotificationChannel({
            name: data.name,
            channel_type: 'webhook',
            config,
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
            {existingChannel ? 'Edit Webhook' : 'Configure Webhook'}
          </DialogTitle>
          <DialogDescription>
            Send JSON payloads to your external API endpoints.
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
                    Webhook URL
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com/webhook"
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
                      Receive alerts on this channel
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
              {existingChannel && (
                <div className="flex gap-2 mr-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onTest(existingChannel)}
                    disabled={isLoading}
                  >
                    <Play className="size-4 mr-1" />
                    Test
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(existingChannel)}
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
                {existingChannel ? 'Save Changes' : 'Create Webhook'}
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
  existingChannel,
  onTest,
  onDelete,
  isPending: parentPending,
}: ConfigDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || parentPending;

  const form = useForm<SlackFormData>({
    resolver: zodResolver(slackFormSchema),
    defaultValues: {
      name: '',
      webhook_url: '',
      channel: '',
      is_enabled: true,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open && existingChannel) {
      const config = existingChannel.config as {
        webhook_url?: string;
        channel?: string;
      };
      form.reset({
        name: existingChannel.name,
        webhook_url: config.webhook_url ?? '',
        channel: config.channel ?? '',
        is_enabled: existingChannel.is_enabled,
      });
    } else if (open) {
      form.reset({
        name: '',
        webhook_url: '',
        channel: '',
        is_enabled: true,
      });
    }
  }, [open, existingChannel, form]);

  const onSubmit = (data: SlackFormData) => {
    startTransition(async () => {
      try {
        const config: Record<string, unknown> = {
          webhook_url: data.webhook_url,
        };
        if (data.channel) {
          config.channel = data.channel;
        }

        if (existingChannel) {
          await updateNotificationChannel(existingChannel.id, {
            name: data.name,
            config,
            is_enabled: data.is_enabled,
          });
          toast.success('Slack channel updated');
        } else {
          await createNotificationChannel({
            name: data.name,
            channel_type: 'slack',
            config,
            is_enabled: data.is_enabled,
          });
          toast.success('Slack channel created');
        }
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save Slack channel';
        toast.error('Failed to save Slack channel', { description: message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {existingChannel ? 'Edit Slack Integration' : 'Configure Slack'}
          </DialogTitle>
          <DialogDescription>
            Send alerts to your Slack workspace using incoming webhooks.
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

            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Channel (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="#alerts"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Override the default channel configured in Slack
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
                      Receive alerts on this channel
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
              {existingChannel && (
                <div className="flex gap-2 mr-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onTest(existingChannel)}
                    disabled={isLoading}
                  >
                    <Play className="size-4 mr-1" />
                    Test
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(existingChannel)}
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
                {existingChannel ? 'Save Changes' : 'Create Slack Integration'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Email Configuration Dialog
// ============================================================================

function EmailConfigDialog({
  open,
  onOpenChange,
  existingChannel,
  onTest,
  onDelete,
  isPending: parentPending,
}: ConfigDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isLoading = isPending || parentPending;

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      name: '',
      recipients: '',
      smtp_host: '',
      smtp_port: 587,
      smtp_username: '',
      smtp_password: '',
      from_address: '',
      is_enabled: true,
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open && existingChannel) {
      const config = existingChannel.config as {
        recipients?: string[];
        smtp_host?: string;
        smtp_port?: number;
        smtp_username?: string;
        smtp_password?: string;
        from_address?: string;
      };
      form.reset({
        name: existingChannel.name,
        recipients: config.recipients?.join(', ') ?? '',
        smtp_host: config.smtp_host ?? '',
        smtp_port: config.smtp_port ?? 587,
        smtp_username: config.smtp_username ?? '',
        smtp_password: config.smtp_password ?? '',
        from_address: config.from_address ?? '',
        is_enabled: existingChannel.is_enabled,
      });
    } else if (open) {
      form.reset({
        name: '',
        recipients: '',
        smtp_host: '',
        smtp_port: 587,
        smtp_username: '',
        smtp_password: '',
        from_address: '',
        is_enabled: true,
      });
    }
  }, [open, existingChannel, form]);

  const onSubmit = (data: EmailFormData) => {
    startTransition(async () => {
      try {
        const recipients = data.recipients
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean);

        const config: Record<string, unknown> = {
          recipients,
          smtp_host: data.smtp_host,
          smtp_port: data.smtp_port,
          from_address: data.from_address,
        };
        if (data.smtp_username) {
          config.smtp_username = data.smtp_username;
        }
        if (data.smtp_password) {
          config.smtp_password = data.smtp_password;
        }

        if (existingChannel) {
          await updateNotificationChannel(existingChannel.id, {
            name: data.name,
            config,
            is_enabled: data.is_enabled,
          });
          toast.success('Email channel updated');
        } else {
          await createNotificationChannel({
            name: data.name,
            channel_type: 'email',
            config,
            is_enabled: data.is_enabled,
          });
          toast.success('Email channel created');
        }
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save email channel';
        toast.error('Failed to save email channel', { description: message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingChannel ? 'Edit Email Channel' : 'Configure Email (SMTP)'}
          </DialogTitle>
          <DialogDescription>
            Send alerts via email using SMTP.
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

            <FormField
              control={form.control}
              name="recipients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Recipients
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="alerts@example.com, team@example.com"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Comma-separated list of email addresses
                  </FormDescription>
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
                      Receive alerts on this channel
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
              {existingChannel && (
                <div className="flex gap-2 mr-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onTest(existingChannel)}
                    disabled={isLoading}
                  >
                    <Play className="size-4 mr-1" />
                    Test
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(existingChannel)}
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
                {existingChannel ? 'Save Changes' : 'Create Email Channel'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
