'use client';

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/shared/ui/components/shadcn/tabs';

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Muted' },
  { value: 'all', label: 'All' },
];

/**
 * The status filter, and only that.
 *
 * The batch actions used to live here, on a line that appeared the moment a
 * checkbox was ticked and pushed the whole table down by its own height. They
 * are now inside the table's own header row, where the columns make room for
 * them instead of the page doing it.
 */
export function IssueFilters({
  currentFilter,
  onFilterChange,
  disabled,
}: {
  currentFilter: string;
  onFilterChange: (filter: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mb-4 shrink-0">
      <Tabs value={currentFilter} onValueChange={onFilterChange}>
        <TabsList>
          {FILTERS.map((filter) => (
            <TabsTrigger
              key={filter.value}
              value={filter.value}
              disabled={disabled}
            >
              {filter.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
