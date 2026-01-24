'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type {
  AlertRule,
  AlertType,
  NotificationChannel,
  Project,
} from '@rustrak/client';
import { Bell, Hash, Loader2, Mail, Plus, Trash2, Webhook } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  createAlertRule,
  deleteAlertRule,
  updateAlertRule,
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// Alert type definitions
const alertTypes: {
  type: AlertType;
  name: string;
  description: string;
}[] = [
  {
    type: 'new_issue',
    name: 'New Issue',
    description: 'When a new issue is first detected',
  },
  {
    type: 'regression',
    name: 'Regression',
    description: 'When a resolved issue reappears',
  },
  {
    type: 'unmute',
    name: 'Unmute',
    description: 'When a muted issue is unmuted',
  },
];

// Form schema
const alertRuleFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  alert_type: z.enum(['new_issue', 'regression', 'unmute']),
  channel_ids: z.array(z.number()).min(1, 'Select at least one channel'),
  is_enabled: z.boolean(),
  cooldown_minutes: z.number().int().min(0),
});

type AlertRuleFormData = z.infer<typeof alertRuleFormSchema>;

// Channel icon helper
function ChannelIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  switch (type) {
    case 'slack':
      return <Hash className={className} />;
    case 'email':
      return <Mail className={className} />;
    case 'webhook':
      return <Webhook className={className} />;
    default:
      return <Bell className={className} />;
  }
}

interface ProjectAlertsDialogProps {
  project: Project;
  alertRules: AlertRule[];
  channels: NotificationChannel[];
}

export function ProjectAlertsDialog({
  project,
  alertRules,
  channels,
}: ProjectAlertsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<AlertRule | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Get channels that are enabled
  const enabledChannels = channels.filter((c) => c.is_enabled);

  // Get alert type info
  const getAlertTypeInfo = (type: string) =>
    alertTypes.find((t) => t.type === type) ?? {
      type,
      name: type,
      description: '',
    };

  // Get channel by ID
  const getChannelById = (id: number) => channels.find((c) => c.id === id);

  // Handle toggle enabled
  const handleToggleEnabled = (rule: AlertRule) => {
    startTransition(async () => {
      try {
        await updateAlertRule(project.id, rule.id, {
          is_enabled: !rule.is_enabled,
        });
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update rule';
        toast.error('Failed to update rule', { description: message });
      }
    });
  };

  // Handle delete
  const handleDelete = () => {
    if (!deletingRule) return;

    startTransition(async () => {
      try {
        await deleteAlertRule(project.id, deletingRule.id);
        toast.success('Alert rule deleted');
        setDeletingRule(null);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete rule';
        toast.error('Failed to delete rule', { description: message });
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" title="Project Alerts">
            <Bell className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Alert Rules</DialogTitle>
            <DialogDescription>
              Configure when to send notifications for this project.
            </DialogDescription>
          </DialogHeader>

          {enabledChannels.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="size-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                No notification channels configured
              </p>
              <p className="text-xs text-muted-foreground">
                Go to{' '}
                <a href="/settings/alerts" className="text-primary underline">
                  Settings → Global Alerts
                </a>{' '}
                to add channels first.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Existing Rules */}
              {alertRules.length > 0 && (
                <div className="space-y-2">
                  {alertRules.map((rule) => {
                    const typeInfo = getAlertTypeInfo(rule.alert_type);
                    return (
                      <div
                        key={rule.id}
                        className={cn(
                          'flex items-center justify-between gap-4 p-3 rounded-lg border',
                          !rule.is_enabled && 'opacity-60',
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {rule.name}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {typeInfo.name}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {rule.channel_ids.map((channelId) => {
                              const channel = getChannelById(channelId);
                              if (!channel) return null;
                              return (
                                <Badge
                                  key={channelId}
                                  variant="outline"
                                  className="text-[10px] gap-1"
                                >
                                  <ChannelIcon
                                    type={channel.channel_type}
                                    className="size-3"
                                  />
                                  {channel.name}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.is_enabled}
                            onCheckedChange={() => handleToggleEnabled(rule)}
                            disabled={isPending}
                            size="sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingRule(rule)}
                            disabled={isPending}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="size-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingRule(rule)}
                            disabled={isPending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Rule Button or Form */}
              {!showAddForm && !editingRule ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="size-4 mr-2" />
                  Add Alert Rule
                </Button>
              ) : null}

              {/* Add/Edit Form */}
              {(showAddForm || editingRule) && (
                <AlertRuleForm
                  projectId={project.id}
                  channels={enabledChannels}
                  existingRule={editingRule}
                  existingRuleTypes={alertRules.map((r) => r.alert_type)}
                  onCancel={() => {
                    setShowAddForm(false);
                    setEditingRule(null);
                  }}
                  onSuccess={() => {
                    setShowAddForm(false);
                    setEditingRule(null);
                    router.refresh();
                  }}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingRule}
        onOpenChange={(open) => !open && setDeletingRule(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingRule?.name}&quot;?
              This action cannot be undone.
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
    </>
  );
}

// ============================================================================
// Alert Rule Form Component
// ============================================================================

interface AlertRuleFormProps {
  projectId: number;
  channels: NotificationChannel[];
  existingRule: AlertRule | null;
  existingRuleTypes: string[];
  onCancel: () => void;
  onSuccess: () => void;
}

function AlertRuleForm({
  projectId,
  channels,
  existingRule,
  existingRuleTypes,
  onCancel,
  onSuccess,
}: AlertRuleFormProps) {
  const [isPending, startTransition] = useTransition();

  // Available alert types (exclude already used ones, unless editing)
  const availableTypes = alertTypes.filter(
    (t) =>
      !existingRuleTypes.includes(t.type) ||
      (existingRule && existingRule.alert_type === t.type),
  );

  const form = useForm<AlertRuleFormData>({
    resolver: zodResolver(alertRuleFormSchema),
    defaultValues: {
      name: '',
      alert_type: availableTypes[0]?.type ?? 'new_issue',
      channel_ids: [],
      is_enabled: true,
      cooldown_minutes: 0,
    },
  });

  // Reset form when existingRule changes
  useEffect(() => {
    if (existingRule) {
      form.reset({
        name: existingRule.name,
        alert_type: existingRule.alert_type,
        channel_ids: existingRule.channel_ids,
        is_enabled: existingRule.is_enabled,
        cooldown_minutes: existingRule.cooldown_minutes,
      });
    } else {
      // Compute default type inside effect to avoid dependency on availableTypes array
      const defaultType =
        alertTypes.find((t) => !existingRuleTypes.includes(t.type))?.type ??
        'new_issue';
      form.reset({
        name: '',
        alert_type: defaultType,
        channel_ids: [],
        is_enabled: true,
        cooldown_minutes: 0,
      });
    }
  }, [existingRule, existingRuleTypes, form]);

  const onSubmit = (data: AlertRuleFormData) => {
    startTransition(async () => {
      try {
        if (existingRule) {
          await updateAlertRule(projectId, existingRule.id, {
            name: data.name,
            is_enabled: data.is_enabled,
            channel_ids: data.channel_ids,
            cooldown_minutes: data.cooldown_minutes,
          });
          toast.success('Alert rule updated');
        } else {
          await createAlertRule(projectId, {
            name: data.name,
            alert_type: data.alert_type,
            channel_ids: data.channel_ids,
            is_enabled: data.is_enabled,
            cooldown_minutes: data.cooldown_minutes,
          });
          toast.success('Alert rule created');
        }
        onSuccess();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save rule';
        toast.error('Failed to save rule', { description: message });
      }
    });
  };

  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      <h4 className="font-medium text-sm mb-4">
        {existingRule ? 'Edit Alert Rule' : 'New Alert Rule'}
      </h4>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Rule Name
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., Notify team on new issues"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="alert_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Trigger
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={isPending || !!existingRule}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableTypes.map((type) => (
                      <SelectItem key={type.type} value={type.type}>
                        <div>
                          <span>{type.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            - {type.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="channel_ids"
            render={() => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Send To
                </FormLabel>
                <div className="space-y-2">
                  {channels.map((channel) => (
                    <FormField
                      key={channel.id}
                      control={form.control}
                      name="channel_ids"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(channel.id)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                if (checked) {
                                  field.onChange([...current, channel.id]);
                                } else {
                                  field.onChange(
                                    current.filter((id) => id !== channel.id),
                                  );
                                }
                              }}
                              disabled={isPending}
                            />
                          </FormControl>
                          <div className="flex items-center gap-2">
                            <ChannelIcon
                              type={channel.channel_type}
                              className="size-4 text-muted-foreground"
                            />
                            <span className="text-sm">{channel.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {channel.channel_type}
                            </Badge>
                          </div>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cooldown_minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Cooldown (minutes)
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    disabled={isPending}
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value, 10) || 0)
                    }
                  />
                </FormControl>
                <FormDescription>
                  Minimum time between alerts for the same issue (0 = no limit)
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
                  <FormLabel className="text-sm font-medium">Enabled</FormLabel>
                  <FormDescription className="text-xs">
                    Start sending alerts immediately
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              {existingRule ? 'Save Changes' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
