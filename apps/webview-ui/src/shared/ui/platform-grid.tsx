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

/** Sentry's generic escape hatch, a real platform id the server accepts. */
const OTHER_PLATFORM_ID = 'other';

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
  //
  // `other` is pulled out of the list and pinned as the first card in every
  // tab: it is the escape hatch, and burying it alphabetically under "O" in a
  // 127-entry grid hides the one option that always applies.
  const platforms: Platform[] = useMemo(
    () =>
      (query.trim()
        ? searchPlatforms(query)
        : categoryPlatforms(category)
      ).filter((p) => p.id !== OTHER_PLATFORM_ID),
    [query, category],
  );

  const isSearching = query.trim().length > 0;
  const otherSelected = value === OTHER_PLATFORM_ID;

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
        // Sentry's own empty state points at "Other" rather than leaving the
        // user stuck, since `other` is a real, storable platform id and the
        // picker otherwise requires a choice.
        <div className="px-4 py-16 text-center">
          <p className="text-sm font-medium">
            No SDK for &quot;{query.trim()}&quot; yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Try a more generic SDK such as JavaScript, Python or Node, or create
            a generic project with{' '}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setQuery('');
                onValueChange(OTHER_PLATFORM_ID);
              }}
              className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
            >
              Other
            </button>
            .
          </p>
        </div>
      ) : (
        // The inner scroll area only earns its keep next to the sticky aside on
        // large screens. On a phone it nests a scroll inside the page scroll,
        // which fights the thumb; there the grid just flows, which is what
        // Sentry's own picker does at every width.
        <div className="overflow-visible p-3 lg:max-h-[28rem] lg:overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {/* Full row rather than a tile: the copy has to be readable to do
                its job, and a grid cell truncates it. Spanning also stops it
                reading as "just another platform", which it is not. */}
            <button
              type="button"
              disabled={disabled}
              aria-pressed={otherSelected}
              onClick={() => onValueChange(OTHER_PLATFORM_ID)}
              className={cn(
                'col-span-full flex items-center gap-3 rounded-lg border border-dashed p-3 text-left transition-all disabled:opacity-50',
                otherSelected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-muted-foreground/30 hover:bg-accent',
              )}
            >
              <PlatformIcon platform={OTHER_PLATFORM_ID} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  Other platform
                </span>
                <span className="block text-xs text-muted-foreground">
                  Your platform is not on the list, or you would rather choose
                  later. Works with any Sentry SDK.
                </span>
              </span>
              {otherSelected && (
                <Check className="size-4 shrink-0 text-primary" />
              )}
            </button>

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
      ;
    </div>
  );
}
