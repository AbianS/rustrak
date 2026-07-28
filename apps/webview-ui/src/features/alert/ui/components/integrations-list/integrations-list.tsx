'use client';

import type { AlertIntegration, ProviderType } from '@rustrak/client';
import { Bell, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  deleteIntegration,
  testIntegration,
} from '@/features/alert/api/mutations';
import { alertProviders } from '@/features/alert/model/providers';
import { IntegrationConfigDialog } from '@/features/alert/ui/components/integration-config-dialog/integration-config-dialog';
import { ProviderIcon } from '@/features/alert/ui/components/provider-icon';
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
} from '@/shared/ui/components/shadcn/alert-dialog';
import { Badge } from '@/shared/ui/components/shadcn/badge';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/components/shadcn/collapsible';
import { ManageDialog } from './manage-dialog';

// Active alert notification providers
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
                      <ProviderIcon
                        type={providerDef.type}
                        className="size-5"
                      />
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

      <IntegrationConfigDialog
        provider={configureType}
        onOpenChange={(open) => !open && closeConfigure()}
        existingIntegration={editIntegration}
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
