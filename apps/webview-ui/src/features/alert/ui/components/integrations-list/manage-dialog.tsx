'use client';

import type { AlertIntegration } from '@rustrak/client';
import { Plus, Trash2 } from 'lucide-react';
import type { alertProviders } from '@/features/alert/model/providers';
import { ProviderIcon } from '@/features/alert/ui/components/provider-icon';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/components/shadcn/dialog';

/**
 * Every instance already configured for one provider, with the actions that
 * act on a single one of them.
 *
 * Separate from the config dialog because it answers a different question:
 * that one edits an integration, this one picks which integration to edit.
 */
export interface ManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerDef: (typeof alertProviders)[number];
  instances: AlertIntegration[];
  onEdit: (integration: AlertIntegration) => void;
  onAdd: () => void;
  onDelete: (integration: AlertIntegration) => void;
}

export function ManageDialog({
  open,
  onOpenChange,
  providerDef,
  instances,
  onEdit,
  onAdd,
  onDelete,
}: ManageDialogProps) {
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
              <ProviderIcon type={providerDef.type} className="size-4.5" />
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
