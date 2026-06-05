'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type {
  AlertIntegration,
  AlertRule,
  AlertType,
  Project,
} from '@rustrak/client';
import {
  Bell,
  BellOff,
  Hash,
  Loader2,
  Mail,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Alert type definitions
const alertTypes: {
  type: AlertType;
  name: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    type: 'new_issue',
    name: 'New Issue',
    description: 'A new issue is first detected',
    icon: Zap,
  },
  {
    type: 'regression',
    name: 'Regression',
    description: 'A resolved issue reappears',
    icon: RefreshCw,
  },
  {
    type: 'unmute',
    name: 'Unmute',
    description: 'A muted issue is unmuted',
    icon: BellOff,
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

function getSlackMethod(integration: AlertIntegration): string {
  return (
    ((integration.credentials as Record<string, unknown>).method as string) ??
    'webhook'
  );
}

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
      icon: Bell,
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Alert Rules</DialogTitle>
            <DialogDescription>
              Configure when to send notifications for this project.
            </DialogDescription>
          </DialogHeader>

          {enabledIntegrations.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                <Bell className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No integrations configured</p>
              <p className="mt-1 text-xs text-muted-foreground">
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
            <div className="space-y-3">
              {alertRules.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  No alert rules yet. Create one to start receiving
                  notifications.
                </p>
              )}

              {alertRules.map((rule) => {
                const typeInfo = getAlertTypeInfo(rule.alert_type);
                const TypeIcon = typeInfo.icon;
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border bg-card p-3 transition-opacity',
                      !rule.is_enabled && 'opacity-50',
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <TypeIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {rule.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {typeInfo.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ·
                        </span>
                        {rule.integration_ids.map((integrationId) => {
                          const integration = getIntegrationById(integrationId);
                          if (!integration) return null;
                          return (
                            <Badge
                              key={integrationId}
                              variant="outline"
                              className="text-[10px] gap-1 py-0"
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={() => handleToggleEnabled(rule)}
                        disabled={isPending}
                        size="sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-foreground"
                        onClick={() => setEditingRule(rule)}
                        disabled={isPending}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingRule(rule)}
                        disabled={isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="size-4 mr-2" />
                Add Alert Rule
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Form dialog — create */}
      <AlertRuleFormDialog
        open={showAddForm}
        onOpenChange={(o) => !o && setShowAddForm(false)}
        projectId={project.id}
        integrations={enabledIntegrations}
        existingRule={null}
        existingRuleTypes={alertRules.map((r) => r.alert_type)}
        onSuccess={() => {
          setShowAddForm(false);
          router.refresh();
        }}
      />

      {/* Form dialog — edit */}
      <AlertRuleFormDialog
        open={!!editingRule}
        onOpenChange={(o) => !o && setEditingRule(null)}
        projectId={project.id}
        integrations={enabledIntegrations}
        existingRule={editingRule}
        existingRuleTypes={alertRules.map((r) => r.alert_type)}
        onSuccess={() => {
          setEditingRule(null);
          router.refresh();
        }}
      />

      {/* Delete confirmation */}
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
// Alert Rule Form Dialog
// ============================================================================

interface AlertRuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  integrations: AlertIntegration[];
  existingRule: AlertRule | null;
  existingRuleTypes: string[];
  onSuccess: () => void;
}

function AlertRuleFormDialog({
  open,
  onOpenChange,
  projectId,
  integrations,
  existingRule,
  existingRuleTypes,
  onSuccess,
}: AlertRuleFormDialogProps) {
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
    if (!open) return;
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
  }, [open, existingRule, existingRuleTypes, form]);

  const selectedIds = form.watch('selected_integration_ids');
  const cooldown = form.watch('cooldown_minutes');
  const alertType = form.watch('alert_type');

  const toggleIntegration = (id: number, enabled: boolean) => {
    const current = form.getValues('selected_integration_ids');
    if (enabled) {
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
        const channelsPayload = data.selected_integration_ids.map((id) => {
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
            channels: channelsPayload,
            cooldown_minutes: data.cooldown_minutes,
          });
          toast.success('Alert rule updated');
        } else {
          await createAlertRule(projectId, {
            name: data.name,
            alert_type: data.alert_type,
            channels: channelsPayload,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingRule ? 'Edit Alert Rule' : 'New Alert Rule'}
          </DialogTitle>
          <DialogDescription>
            {existingRule
              ? 'Update when and where this rule sends notifications.'
              : 'Define when to trigger an alert and where to send it.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5 py-1"
          >
            {/* Name */}
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
                      autoComplete="off"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trigger — radio cards */}
            <FormField
              control={form.control}
              name="alert_type"
              render={() => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Trigger
                  </FormLabel>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {availableTypes.map((t) => {
                      const Icon = t.icon;
                      const isSelected = alertType === t.type;
                      return (
                        <button
                          key={t.type}
                          type="button"
                          disabled={isPending || !!existingRule}
                          onClick={() =>
                            form.setValue('alert_type', t.type, {
                              shouldValidate: true,
                            })
                          }
                          className={cn(
                            'flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all',
                            'hover:border-primary/50 hover:bg-accent/50',
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-border bg-card',
                            (isPending || !!existingRule) &&
                              'opacity-60 cursor-not-allowed',
                          )}
                        >
                          <Icon
                            className={cn(
                              'size-4',
                              isSelected
                                ? 'text-primary'
                                : 'text-muted-foreground',
                            )}
                          />
                          <div>
                            <p
                              className={cn(
                                'text-xs font-semibold leading-none',
                                isSelected ? 'text-primary' : 'text-foreground',
                              )}
                            >
                              {t.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                              {t.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Send To — integration toggle cards */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Send To
              </p>
              <div className="space-y-2">
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
                  const hasRoutingFields =
                    needsChannel ||
                    needsRecipients ||
                    integration.provider_type === 'webhook';

                  return (
                    <div key={integration.id}>
                      {/* Toggle card — never changes background, only border */}
                      <div
                        className={cn(
                          'flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 transition-colors',
                          isSelected ? 'border-primary/50' : 'border-border',
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              'flex size-7 items-center justify-center rounded-md transition-colors',
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            <ProviderIcon
                              type={integration.provider_type}
                              className="size-3.5"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-none">
                              {integration.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                              {integration.provider_type}
                              {isSlackBot ? ' · bot token' : ''}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            toggleIntegration(integration.id, checked)
                          }
                          disabled={isPending}
                          size="sm"
                        />
                      </div>

                      {/* Routing fields — separate block below the card */}
                      {isSelected && hasRoutingFields && (
                        <div className="mx-3 rounded-b-lg border border-t-0 border-primary/20 bg-muted/40 px-3 py-3 space-y-3">
                          {needsChannel && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">
                                Channel{' '}
                                <span className="text-destructive">*</span>
                              </label>
                              <Input
                                placeholder="#alerts or C1234567890"
                                value={routing.channel ?? ''}
                                onChange={(e) =>
                                  updateRoutingField(
                                    integration.id,
                                    'channel',
                                    e.target.value,
                                  )
                                }
                                disabled={isPending}
                                className="h-8 text-sm"
                                autoComplete="off"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Channel name (e.g.{' '}
                                <code className="font-mono">#alerts</code>) or
                                channel ID (e.g.{' '}
                                <code className="font-mono">C1234567890</code>)
                              </p>
                            </div>
                          )}
                          {needsRecipients && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">
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
                                className="text-sm min-h-15 resize-none"
                                autoComplete="off"
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Comma-separated email addresses
                              </p>
                            </div>
                          )}
                          {integration.provider_type === 'webhook' && (
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">
                                Override URL
                                {needsUrl ? (
                                  <span className="text-destructive"> *</span>
                                ) : (
                                  <span className="text-muted-foreground/60">
                                    {' '}
                                    (optional)
                                  </span>
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
                                className="h-8 text-sm"
                                autoComplete="off"
                              />
                              {!needsUrl && (
                                <p className="text-[10px] text-muted-foreground">
                                  Overrides the URL configured in credentials
                                </p>
                              )}
                            </div>
                          )}
                          {routingErr && (
                            <p className="text-xs text-destructive">
                              {routingErr}
                            </p>
                          )}
                        </div>
                      )}

                      {isSelected && routingErr && !hasRoutingFields && (
                        <p className="mx-3 text-xs text-destructive">
                          {routingErr}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {form.formState.errors.selected_integration_ids && (
                <p className="text-xs text-destructive mt-1.5">
                  {form.formState.errors.selected_integration_ids.message}
                </p>
              )}
            </div>

            {/* Cooldown */}
            <FormField
              control={form.control}
              name="cooldown_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Cooldown
                  </FormLabel>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                      disabled={isPending || cooldown <= 0}
                      onClick={() => field.onChange(Math.max(0, cooldown - 5))}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        disabled={isPending}
                        className="text-center"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value, 10) || 0)
                        }
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 shrink-0"
                      disabled={isPending}
                      onClick={() => field.onChange(cooldown + 5)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <span className="text-sm text-muted-foreground shrink-0">
                      min
                    </span>
                  </div>
                  <FormDescription>
                    {cooldown === 0
                      ? 'No limit — alert fires every time'
                      : `At most one alert every ${cooldown} minute${cooldown !== 1 ? 's' : ''} per issue`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Enabled toggle */}
            <FormField
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-sm font-medium">
                      Enable rule
                    </FormLabel>
                    <FormDescription className="text-xs">
                      Start sending alerts immediately after saving
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
                {existingRule ? 'Save Changes' : 'Create Rule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
