'use client';

import type { AlertIntegration, AlertRule, Project } from '@rustrak/client';
import { Bell, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  deleteAlertRule,
  updateAlertRule,
} from '@/features/alert/api/mutations';
import { AlertRuleFormDialog } from '@/features/alert/ui/components/alert-rule-dialog/alert-rule-dialog';
import { AlertRulesTable } from '@/features/alert/ui/components/alert-rules-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/components/shadcn/alert-dialog';
import { Button } from '@/shared/ui/components/shadcn/button';

interface AlertsSettingsProps {
  project: Project;
  alertRules: AlertRule[];
  channels: AlertIntegration[];
}

export function AlertsSettings({
  project,
  alertRules,
  channels,
}: AlertsSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<AlertRule | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const enabledIntegrations = channels.filter((c) => c.is_enabled);

  const getIntegrationById = (id: number) => channels.find((c) => c.id === id);

  const handleToggleEnabled = (rule: AlertRule) => {
    startTransition(async () => {
      const result = await updateAlertRule(project.id, rule.id, {
        is_enabled: !rule.is_enabled,
      });

      if (!result.success) {
        // A switch in a table row, not a form field: the message is the only
        // place this can go.
        toast.error('Failed to update rule', {
          description: result.error.message,
        });
        return;
      }

      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!deletingRule) return;
    startTransition(async () => {
      const result = await deleteAlertRule(project.id, deletingRule.id);

      if (!result.success) {
        toast.error('Failed to delete rule', {
          description: result.error.message,
        });
        return;
      }

      toast.success('Alert rule deleted');
      setDeletingRule(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4 md:mb-8">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">
            Alert Settings
          </h1>
          <p className="mt-1 text-muted-foreground">
            Configure when to send notifications for this project.
          </p>
        </div>
        {enabledIntegrations.length > 0 && (
          <Button onClick={() => setShowAddForm(true)} className="shrink-0">
            <Plus className="mr-2 size-4" />
            Add Alert Rule
          </Button>
        )}
      </div>

      {enabledIntegrations.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <Bell className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No integrations configured</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Go to{' '}
            <Link
              href="/settings/integrations"
              className="text-primary underline"
            >
              Settings → Integrations
            </Link>{' '}
            to add integrations first.
          </p>
        </div>
      ) : alertRules.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <Bell className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No alert rules yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create one to start receiving notifications.
          </p>
        </div>
      ) : (
        <AlertRulesTable
          rules={alertRules}
          getIntegrationById={getIntegrationById}
          disabled={isPending}
          onToggleEnabled={handleToggleEnabled}
          onEdit={setEditingRule}
          onDelete={setDeletingRule}
        />
      )}

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
