'use client';

import { Check, Search } from 'lucide-react';
import { PlatformIcon } from 'platformicons';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  categoryPlatforms,
  PLATFORM_CATEGORIES,
  type Platform,
  searchPlatforms,
} from '@/lib/platforms';
import { cn } from '@/lib/utils';

interface PlatformGridProps {
  value: string | null;
  onValueChange: (platformId: string) => void;
  disabled?: boolean;
}

/**
 * Category tabs + search + icon grid, mirroring Sentry's own create-project
 * picker rather than the searchable combobox used in project settings. The
 * combobox is right for changing one field in a settings form; picking a
 * platform is the primary act of this page, so it gets the room.
 */
export function PlatformGrid({
  value,
  onValueChange,
  disabled,
}: PlatformGridProps) {
  const [category, setCategory] = useState('popular');
  const [query, setQuery] = useState('');

  // A non-empty query deliberately searches every platform, ignoring the
  // active tab. Sentry does the same: someone who types "django" while Browser
  // is open should find it rather than be told there are no results.
  const platforms: Platform[] = useMemo(
    () => (query.trim() ? searchPlatforms(query) : categoryPlatforms(category)),
    [query, category],
  );

  const isSearching = query.trim().length > 0;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 border-b p-3 sm:flex-row-reverse sm:items-center">
        <div className="relative sm:w-56 sm:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all platforms"
            aria-label="Search platforms"
            disabled={disabled}
            className="h-9 pl-9"
          />
        </div>

        <div
          className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1"
          role="tablist"
          aria-label="Platform categories"
        >
          {PLATFORM_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={!isSearching && category === c.id}
              disabled={disabled}
              onClick={() => {
                setCategory(c.id);
                // Changing tab clears the query, otherwise the tab appears to
                // do nothing while a search is active.
                setQuery('');
              }}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                !isSearching && category === c.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {platforms.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-muted-foreground">
          Nothing matches &quot;{query.trim()}&quot;.
        </p>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {platforms.map((p) => {
              const selected = value === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => onValueChange(p.id)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg border p-3 text-left transition-all disabled:opacity-50',
                    selected
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-transparent bg-muted/40 hover:bg-accent',
                  )}
                >
                  <PlatformIcon platform={p.id} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {p.name}
                  </span>
                  {selected && (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t px-4 py-2 text-xs text-muted-foreground">
        {isSearching
          ? `${platforms.length} matching ${platforms.length === 1 ? 'platform' : 'platforms'}`
          : `${platforms.length} platforms · search to look across every category`}
      </div>
    </div>
  );
}
