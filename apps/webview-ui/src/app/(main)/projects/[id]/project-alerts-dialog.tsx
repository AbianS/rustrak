'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type {
  AlertIntegration,
  AlertRule,
  AlertType,
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
import { Textarea } from '@/components/ui/textarea';
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

// Per-channel routing_override map keyed by integration ID
type RoutingMap = Record<number, Record<string, string>>;

// Form schema
const alertRuleFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  alert_type: z.enum(['new_issue', 'regression', 'unmute']),
  selected_integration_ids: z.array(z.number()),
  routing_map: z
    .record(z.string(), z.record(z.string(), z.string()))
    .optional(),
  is_enabled: z.boolean(),
  cooldown_minutes: z.number().int().min(0),
});

type AlertRuleFormData = z.infer<typeof alertRuleFormSchema>;

// Provider icon helper
function ProviderIcon({
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

// Helper: get credentials method for a Slack integration
function getSlackMethod(integration: AlertIntegration): string {
  return (
    ((integration.credentials as Record<string, unknown>).method as string) ??
    'webhook'
  );
}

// Helper: validate routing fields for a given integration before submit
function validateRoutingForIntegration(
  integration: AlertIntegration,
  routing: Record<string, string>,
): string | null {
  if (integration.provider_type === 'slack') {
    if (getSlackMethod(integration) === 'bot_token') {
      if (!routing.channel || routing.channel.trim() === '') {
        return `Slack channel is required for "${integration.name}"`;
      }
    }
  }
  if (integration.provider_type === 'email') {
    if (!routing.recipients || routing.recipients.trim() === '') {
      return `Recipients are required for "${integration.name}"`;
    }
    const addrs = routing.recipients
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    if (addrs.length === 0 || addrs.some((a) => !a.includes('@'))) {
      return `Invalid email address in recipients for "${integration.name}"`;
    }
  }
  if (integration.provider_type === 'webhook') {
    const credUrl = (integration.credentials as Record<string, unknown>).url as
      | string
      | undefined;
    const routeUrl = routing.url?.trim();
    if (!credUrl && !routeUrl) {
      return `A webhook URL is required for "${integration.name}" (set in credentials or as override URL)`;
    }
    if (
      routeUrl &&
      !routeUrl.startsWith('http://') &&
      !routeUrl.startsWith('https://')
    ) {
      return `Override URL for "${integration.name}" must be http/https`;
    }
  }
  return null;
}

interface ProjectAlertsDialogProps {
  project: Project;
  alertRules: AlertRule[];
  channels: AlertIntegration[];
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

  const enabledIntegrations = channels.filter((c) => c.is_enabled);

  const getAlertTypeInfo = (type: string) =>
    alertTypes.find((t) => t.type === type) ?? {
      type,
      name: type,
      description: '',
    };

  const getIntegrationById = (id: number) => channels.find((c) => c.id === id);

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
        <DialogTrigger
          render={
            <Button variant="outline" size="icon" title="Project Alerts" />
          }
        >
          <Bell className="size-4" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Alert Rules</DialogTitle>
            <DialogDescription>
              Configure when to send notifications for this project.
            </DialogDescription>
          </DialogHeader>

          {enabledIntegrations.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="size-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                No integrations configured
              </p>
              <p className="text-xs text-muted-foreground">
                Go to{' '}
                <a
                  href="/settings/integrations"
                  className="text-primary underline"
                >
                  Settings → Integrations
                </a>{' '}
                to add integrations first.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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
                            {rule.integration_ids.map((integrationId) => {
                              const integration =
                                getIntegrationById(integrationId);
                              if (!integration) return null;
                              return (
                                <Badge
                                  key={integrationId}
                                  variant="outline"
                                  className="text-[10px] gap-1"
                                >
                                  <ProviderIcon
                                    type={integration.provider_type}
                                    className="size-3"
                                  />
                                  {integration.name}
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

              {(showAddForm || editingRule) && (
                <AlertRuleForm
                  projectId={project.id}
                  integrations={enabledIntegrations}
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
  integrations: AlertIntegration[];
  existingRule: AlertRule | null;
  existingRuleTypes: string[];
  onCancel: () => void;
  onSuccess: () => void;
}

function AlertRuleForm({
  projectId,
  integrations,
  existingRule,
  existingRuleTypes,
  onCancel,
  onSuccess,
}: AlertRuleFormProps) {
  const [isPending, startTransition] = useTransition();
  const [routingMap, setRoutingMap] = useState<RoutingMap>({});
  const [routingErrors, setRoutingErrors] = useState<Record<number, string>>(
    {},
  );

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
      selected_integration_ids: [],
      is_enabled: true,
      cooldown_minutes: 0,
    },
  });

  useEffect(() => {
    if (existingRule) {
      form.reset({
        name: existingRule.name,
        alert_type: existingRule.alert_type,
        selected_integration_ids: existingRule.integration_ids,
        is_enabled: existingRule.is_enabled,
        cooldown_minutes: existingRule.cooldown_minutes,
      });
      const initialMap: RoutingMap = {};
      for (const ch of existingRule.channels) {
        const override = ch.routing_override ?? {};
        const integration = integrations.find((i) => i.id === ch.integration_id);
        const normalized: Record<string, string> = {};
        if (integration?.provider_type === 'email') {
          const r = override.recipients;
          if (Array.isArray(r)) normalized.recipients = r.join(', ');
        } else {
          for (const [k, v] of Object.entries(override)) {
            if (typeof v === 'string') normalized[k] = v;
          }
        }
        initialMap[ch.integration_id] = normalized;
      }
      setRoutingMap(initialMap);
    } else {
      const defaultType =
        alertTypes.find((t) => !existingRuleTypes.includes(t.type))?.type ??
        'new_issue';
      form.reset({
        name: '',
        alert_type: defaultType,
        selected_integration_ids: [],
        is_enabled: true,
        cooldown_minutes: 0,
      });
      setRoutingMap({});
    }
    setRoutingErrors({});
  }, [existingRule, existingRuleTypes, form]);

  const selectedIds = form.watch('selected_integration_ids');

  const toggleIntegration = (id: number, checked: boolean) => {
    const current = form.getValues('selected_integration_ids');
    if (checked) {
      form.setValue('selected_integration_ids', [...current, id]);
      setRoutingMap((prev) => ({ ...prev, [id]: {} }));
    } else {
      form.setValue(
        'selected_integration_ids',
        current.filter((i) => i !== id),
      );
      setRoutingMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setRoutingErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const updateRoutingField = (
    integrationId: number,
    field: string,
    value: string,
  ) => {
    setRoutingMap((prev) => ({
      ...prev,
      [integrationId]: { ...(prev[integrationId] ?? {}), [field]: value },
    }));
    setRoutingErrors((prev) => {
      const next = { ...prev };
      delete next[integrationId];
      return next;
    });
  };

  const onSubmit = (data: AlertRuleFormData) => {
    // Validate routing fields per integration
    const errors: Record<number, string> = {};
    for (const id of data.selected_integration_ids) {
      const integration = integrations.find((i) => i.id === id);
      if (!integration) continue;
      const routing = routingMap[id] ?? {};
      const err = validateRoutingForIntegration(integration, routing);
      if (err) errors[id] = err;
    }

    if (Object.keys(errors).length > 0) {
      setRoutingErrors(errors);
      return;
    }

    if (data.selected_integration_ids.length === 0) {
      form.setError('selected_integration_ids', {
        message: 'Select at least one integration',
      });
      return;
    }

    startTransition(async () => {
      try {
        // Build channels array
        const channels = data.selected_integration_ids.map((id) => {
          const routing = routingMap[id] ?? {};
          const integration = integrations.find((i) => i.id === id)!;
          const routingOverride: Record<string, unknown> = {};

          if (
            integration.provider_type === 'slack' &&
            getSlackMethod(integration) === 'bot_token'
          ) {
            if (routing.channel)
              routingOverride.channel = routing.channel.trim();
          }
          if (integration.provider_type === 'email' && routing.recipients) {
            routingOverride.recipients = routing.recipients
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean);
          }
          if (integration.provider_type === 'webhook' && routing.url) {
            routingOverride.url = routing.url.trim();
          }

          return { integration_id: id, routing_override: routingOverride };
        });

        if (existingRule) {
          await updateAlertRule(projectId, existingRule.id, {
            name: data.name,
            is_enabled: data.is_enabled,
            channels,
            cooldown_minutes: data.cooldown_minutes,
          });
          toast.success('Alert rule updated');
        } else {
          await createAlertRule(projectId, {
            name: data.name,
            alert_type: data.alert_type,
            channels,
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

          {/* Integration picker + per-integration routing fields */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Send To
            </p>
            <div className="space-y-3">
              {integrations.map((integration) => {
                const isSelected = selectedIds.includes(integration.id);
                const routing = routingMap[integration.id] ?? {};
                const routingErr = routingErrors[integration.id];
                const isSlackBot =
                  integration.provider_type === 'slack' &&
                  getSlackMethod(integration) === 'bot_token';
                const needsChannel = isSlackBot;
                const needsRecipients = integration.provider_type === 'email';
                const credUrl = (
                  integration.credentials as Record<string, unknown>
                ).url as string | undefined;
                const needsUrl =
                  integration.provider_type === 'webhook' && !credUrl;

                return (
                  <div key={integration.id} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleIntegration(integration.id, checked === true)
                        }
                        disabled={isPending}
                      />
                      <div className="flex items-center gap-2">
                        <ProviderIcon
                          type={integration.provider_type}
                          className="size-4 text-muted-foreground"
                        />
                        <span className="text-sm">{integration.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {integration.provider_type}
                          {isSlackBot ? '/bot' : ''}
                        </Badge>
                      </div>
                    </div>

                    {/* Routing override fields — only shown when integration is selected */}
                    {isSelected &&
                      (needsChannel || needsRecipients || needsUrl) && (
                        <div className="ml-7 space-y-2">
                          {needsChannel && (
                            <div>
                              <label className="text-xs text-muted-foreground">
                                Slack Channel{' '}
                                <span className="text-destructive">*</span>
                              </label>
                              <Input
                                placeholder="#alerts"
                                value={routing.channel ?? ''}
                                onChange={(e) =>
                                  updateRoutingField(
                                    integration.id,
                                    'channel',
                                    e.target.value,
                                  )
                                }
                                disabled={isPending}
                                className="h-8 text-sm mt-1"
                              />
                            </div>
                          )}
                          {needsRecipients && (
                            <div>
                              <label className="text-xs text-muted-foreground">
                                Recipients{' '}
                                <span className="text-destructive">*</span>
                              </label>
                              <Textarea
                                placeholder="alerts@example.com, team@example.com"
                                value={routing.recipients ?? ''}
                                onChange={(e) =>
                                  updateRoutingField(
                                    integration.id,
                                    'recipients',
                                    e.target.value,
                                  )
                                }
                                disabled={isPending}
                                className="text-sm mt-1 min-h-[60px]"
                              />
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Comma-separated email addresses
                              </p>
                            </div>
                          )}
                          {integration.provider_type === 'webhook' && (
                            <div>
                              <label className="text-xs text-muted-foreground">
                                Override URL
                                {needsUrl ? (
                                  <span className="text-destructive"> *</span>
                                ) : (
                                  ' (optional)'
                                )}
                              </label>
                              <Input
                                placeholder="https://svc.io/hook"
                                value={routing.url ?? ''}
                                onChange={(e) =>
                                  updateRoutingField(
                                    integration.id,
                                    'url',
                                    e.target.value,
                                  )
                                }
                                disabled={isPending}
                                className="h-8 text-sm mt-1"
                              />
                            </div>
                          )}
                          {routingErr && (
                            <p className="text-xs text-destructive">
                              {routingErr}
                            </p>
                          )}
                        </div>
                      )}

                    {isSelected &&
                      routingErr &&
                      !needsChannel &&
                      !needsRecipients &&
                      !needsUrl && (
                        <p className="ml-7 text-xs text-destructive">
                          {routingErr}
                        </p>
                      )}
                  </div>
                );
              })}
            </div>
            {form.formState.errors.selected_integration_ids && (
              <p className="text-xs text-destructive mt-1">
                {form.formState.errors.selected_integration_ids.message}
              </p>
            )}
          </div>

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
