'use client';

import type { AlertIntegration, AlertRule } from '@rustrak/client';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { alertTypeInfo } from '@/features/alert/model/alert-types';
import { AlertTypeIcon } from '@/features/alert/ui/components/alert-type-icon';
import { ProviderIcon } from '@/features/alert/ui/components/provider-icon';
import { DataTable } from '@/shared/ui/components/data-table/data-table';
import {
  createAppColumnHelper,
  useAppTable,
} from '@/shared/ui/components/data-table/use-app-table';
import { Badge } from '@/shared/ui/components/shadcn/badge';
import { Button } from '@/shared/ui/components/shadcn/button';
import { Switch } from '@/shared/ui/components/shadcn/switch';

const helper = createAppColumnHelper<AlertRule>();

/**
 * The project's alert rules.
 *
 * Split out of `AlertsSettings` when it moved onto the shared table: the
 * settings panel owns the dialogs, the mutations and the empty state, and this
 * owns how a rule is drawn. Neither needed to know the other's business.
 */
export function AlertRulesTable({
  rules,
  getIntegrationById,
  disabled,
  onToggleEnabled,
  onEdit,
  onDelete,
}: {
  rules: AlertRule[];
  getIntegrationById: (id: number) => AlertIntegration | undefined;
  disabled: boolean;
  onToggleEnabled: (rule: AlertRule) => void;
  onEdit: (rule: AlertRule) => void;
  onDelete: (rule: AlertRule) => void;
}) {
  const t = useTranslations('alerts');
  const typesT = useTranslations('alertTypes');
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', {
          header: t('table.rule'),
          minSize: 180,
          meta: { grow: true },
          cell: ({ getValue }) => (
            <span className="truncate font-medium">{getValue()}</span>
          ),
        }),
        helper.accessor('alert_type', {
          id: 'trigger',
          header: t('table.trigger'),
          size: 190,
          minSize: 140,
          cell: ({ getValue }) => (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <AlertTypeIcon type={getValue()} className="size-3.5" />
              <span className="truncate">
                {typesT(alertTypeInfo(getValue()).nameKey)}
              </span>
            </span>
          ),
        }),
        helper.accessor('integration_ids', {
          id: 'channels',
          header: t('table.channels'),
          size: 220,
          minSize: 140,
          cell: ({ getValue }) => (
            <div className="flex flex-wrap gap-1">
              {getValue().map((integrationId) => {
                const integration = getIntegrationById(integrationId);
                if (!integration) return null;
                return (
                  <Badge
                    key={integrationId}
                    variant="outline"
                    className="gap-1 py-0 text-[10px]"
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
          ),
        }),
        helper.accessor('is_enabled', {
          id: 'enabled',
          header: t('table.enabled'),
          size: 90,
          minSize: 80,
          cell: ({ row }) => (
            <Switch
              checked={row.original.is_enabled}
              onCheckedChange={() => onToggleEnabled(row.original)}
              disabled={disabled}
              size="sm"
              aria-label={t('table.enableAria', {
                name: row.original.name,
              })}
            />
          ),
        }),
        helper.display({
          id: 'actions',
          size: 88,
          minSize: 88,
          maxSize: 88,
          meta: { align: 'end' },
          header: () => (
            <span className="sr-only">{t('table.actionsAria')}</span>
          ),
          cell: ({ row }) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('table.editAria', { name: row.original.name })}
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(row.original)}
                disabled={disabled}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                aria-label={t('table.deleteAria', {
                  name: row.original.name,
                })}
                className="size-7"
                onClick={() => onDelete(row.original)}
                disabled={disabled}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ),
        }),
      ]),
    [
      t,
      typesT,
      getIntegrationById,
      disabled,
      onToggleEnabled,
      onEdit,
      onDelete,
    ],
  );

  const table = useAppTable({
    data: rules,
    columns,
    getRowId: (rule) => String(rule.id),
    rowCount: rules.length,
  });

  return (
    <DataTable
      table={table}
      isPending={disabled}
      // A disabled rule still lists, but reads as switched off. This is state
      // about the row rather than about any one of its cells.
      getRowClassName={(row) =>
        row.original.is_enabled ? undefined : 'opacity-50'
      }
    />
  );
}
