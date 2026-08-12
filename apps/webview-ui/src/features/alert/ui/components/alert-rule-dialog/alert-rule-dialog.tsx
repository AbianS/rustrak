'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AlertIntegration, AlertRule } from '@rustrak/client';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  createAlertRule,
  updateAlertRule,
} from '@/features/alert/api/mutations';
import { buildChannelsPayload } from '@/features/alert/lib/routing';
import {
  type AlertRuleFormData,
  alertRuleFormSchema,
} from '@/features/alert/model/alert-rule-form';
import { alertTypes } from '@/features/alert/model/alert-types';
import { useChannelRouting } from '@/features/alert/ui/hooks/use-channel-routing';
import { applyServerFieldErrors } from '@/shared/lib/form-errors';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/components/shadcn/dialog';
import { Form, FormRootError } from '@/shared/ui/components/shadcn/form';
import { ChannelPicker } from './channel-picker/channel-picker';
import { CooldownField } from './fields/cooldown-field';
import { EnabledField } from './fields/enabled-field';
import { NameField } from './fields/name-field';
import { TriggerField } from './fields/trigger-field';

export interface AlertRuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  integrations: AlertIntegration[];
  existingRule: AlertRule | null;
  existingRuleTypes: string[];
  onSuccess: () => void;
}

export function AlertRuleFormDialog({
  open,
  onOpenChange,
  ...bodyProps
}: AlertRuleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertRuleForm
          key={bodyProps.existingRule?.id ?? 'new'}
          onOpenChange={onOpenChange}
          {...bodyProps}
        />
      </DialogContent>
    </Dialog>
  );
}

function AlertRuleForm({
  onOpenChange,
  projectId,
  integrations,
  existingRule,
  existingRuleTypes,
  onSuccess,
}: Omit<AlertRuleFormDialogProps, 'open'>) {
  const t = useTranslations('alerts');

  const globalT = useTranslations();
  const [isPending, startTransition] = useTransition();
  const routing = useChannelRouting(existingRule, integrations);

  // A trigger already covered by another rule is not offered, except the one
  // this rule is already using — otherwise editing a rule would hide its own
  // trigger from its own form.
  const covered = new Set(existingRuleTypes);
  const availableTypes = alertTypes.filter(
    (entry) =>
      !covered.has(entry.type) || existingRule?.alert_type === entry.type,
  );

  // Seeded at mount and never re-seeded: the body only exists while the dialog
  // is open, and the `key` above remounts it when the rule being edited
  // changes, so there is nothing left for an adjustment effect to do.
  const schema = useMemo(() => alertRuleFormSchema(t), [t]);
  const form = useForm<AlertRuleFormData>({
    resolver: zodResolver(schema),
    defaultValues: existingRule
      ? {
          name: existingRule.name,
          alert_type: existingRule.alert_type,
          selected_integration_ids: existingRule.integration_ids,
          is_enabled: existingRule.is_enabled,
          cooldown_minutes: existingRule.cooldown_minutes,
        }
      : {
          name: '',
          alert_type: availableTypes[0]?.type ?? 'new_issue',
          selected_integration_ids: [],
          is_enabled: true,
          cooldown_minutes: 0,
        },
  });

  const onSubmit = (data: AlertRuleFormData) => {
    if (!routing.validate(data.selected_integration_ids)) return;

    if (data.selected_integration_ids.length === 0) {
      form.setError('selected_integration_ids', {
        message: t('ruleDialog.selectAtLeastOne'),
      });
      return;
    }

    startTransition(async () => {
      const channels = buildChannelsPayload(
        data.selected_integration_ids,
        routing.routingMap,
        integrations,
      );

      const result = existingRule
        ? await updateAlertRule(projectId, existingRule.id, {
            name: data.name,
            is_enabled: data.is_enabled,
            channels,
            cooldown_minutes: data.cooldown_minutes,
          })
        : await createAlertRule(projectId, {
            name: data.name,
            alert_type: data.alert_type,
            channels,
            is_enabled: data.is_enabled,
            cooldown_minutes: data.cooldown_minutes,
          });

      if (!result.success) {
        // A duplicate rule name is a `conflict` naming `name`, and a second
        // rule for an alert type already covered is one naming `alert_type`.
        // Both are fields this dialog registers, so both land on their input.
        const applied = applyServerFieldErrors(form, result.error, {
          labels: {
            name: t('common.fieldName'),
            alert_type: t('ruleDialog.fieldAlertType'),
          },
          t: globalT,
        });

        if (applied.formLevel) {
          toast.error(t('ruleDialog.saveFailed'), {
            description: applied.formLevel,
          });
        }
        return;
      }

      toast.success(
        t(existingRule ? 'ruleDialog.updated' : 'ruleDialog.created'),
      );
      onSuccess();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t(existingRule ? 'ruleDialog.titleEdit' : 'ruleDialog.titleNew')}
        </DialogTitle>
        <DialogDescription>
          {t(existingRule ? 'ruleDialog.descEdit' : 'ruleDialog.descNew')}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 py-1">
          <NameField disabled={isPending} />
          <TriggerField
            types={availableTypes}
            disabled={isPending}
            locked={existingRule !== null}
          />
          <ChannelPicker
            integrations={integrations}
            routing={routing}
            disabled={isPending}
          />
          <CooldownField disabled={isPending} />
          <EnabledField disabled={isPending} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              {t(existingRule ? 'ruleDialog.saveChanges' : 'ruleDialog.create')}
            </Button>
          </DialogFooter>
          {/* Where a failure that named no field of this form lands. */}
          <FormRootError />
        </form>
      </Form>
    </>
  );
}
