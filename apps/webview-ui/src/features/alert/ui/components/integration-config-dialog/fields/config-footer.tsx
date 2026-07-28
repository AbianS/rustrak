'use client';

import type { AlertIntegration } from '@rustrak/client';
import { Loader2, Play, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/components/shadcn/button';
import { DialogFooter } from '@/shared/ui/components/shadcn/dialog';

/**
 * The row of actions every provider dialog ends with.
 *
 * Test and Delete only exist once the integration does, and they sit apart
 * from Cancel/Save on `mr-auto` because they act on the stored record rather
 * than on the draft in the form.
 *
 * `onTest` is optional so a provider that needs routing input before it can
 * send one (Slack picks a channel, Email picks recipients) can render its own
 * test control higher up and leave this slot empty, rather than showing a
 * second Test button that means something narrower.
 */
export function ConfigFooter({
  existingIntegration,
  submitLabel,
  isLoading,
  onTest,
  onDelete,
  onCancel,
}: {
  existingIntegration: AlertIntegration | null;
  submitLabel: string;
  isLoading: boolean;
  onTest?: (integration: AlertIntegration) => void;
  onDelete: (integration: AlertIntegration) => void;
  onCancel: () => void;
}) {
  return (
    <DialogFooter className="gap-2 sm:gap-0">
      {existingIntegration && (
        <div className="flex gap-2 mr-auto">
          {onTest && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onTest(existingIntegration)}
              disabled={isLoading}
            >
              <Play className="size-4 mr-1" />
              Test
            </Button>
          )}
          {/* `destructive` rather than the outline-plus-red-text the webhook
              dialog used: two of the three already painted it this way, and a
              delete that looks different depending on which provider you are
              editing is a difference that means nothing. */}
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
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isLoading}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={isLoading}>
        {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}
