'use client';

import { Check, Trash2, VolumeX } from 'lucide-react';
import { Button } from '@/shared/ui/components/shadcn/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/shared/ui/components/shadcn/tabs';
import type { IssueAction } from './issue-row';

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Muted' },
  { value: 'all', label: 'All' },
];

/**
 * The status filter, and the actions that appear once rows are ticked.
 *
 * The batch bar occupies its own line rather than sitting beside the tabs, so
 * the tabs do not shift sideways the moment a checkbox is clicked.
 */
export function IssueFilters({
  currentFilter,
  onFilterChange,
  selectedCount,
  disabled,
  onBatchAction,
  onBatchDelete,
}: {
  currentFilter: string;
  onFilterChange: (filter: string) => void;
  selectedCount: number;
  disabled: boolean;
  onBatchAction: (action: IssueAction) => void;
  onBatchDelete: () => void;
}) {
  return (
    <div className="shrink-0 flex flex-col gap-2 mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <Tabs value={currentFilter} onValueChange={onFilterChange}>
          <TabsList>
            {FILTERS.map((filter) => (
              <TabsTrigger key={filter.value} value={filter.value}>
                {filter.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBatchAction('resolve')}
            disabled={disabled}
          >
            <Check className="mr-1 size-3" />
            Resolve
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBatchAction('mute')}
            disabled={disabled}
          >
            <VolumeX className="mr-1 size-3" />
            Mute
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onBatchDelete}
            disabled={disabled}
          >
            <Trash2 className="mr-1 size-3" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
