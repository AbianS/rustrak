import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import {
  CommandItem,
  CommandShortcut,
} from '@/shared/ui/components/shadcn/command';
import { IconTile } from '../primitives/icon-tile';

/**
 * Selection styling, spelled out rather than left to the generated component.
 *
 * Two things force this. cmdk writes `data-selected="false"` on every row, and
 * Tailwind's bare `data-selected:` variant matches the attribute's *presence*,
 * so the kit's own `data-selected:bg-muted` paints the whole list and the
 * active row is indistinguishable. And `--muted` sits four points of luminance
 * from `--popover` in this theme, which is not enough to read as a highlight
 * even once only one row gets it. Hence the explicit `=true` test and the
 * primary tint.
 */
const SELECTED_ROW = cn(
  'data-[selected=false]:bg-transparent!',
  'data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary',
);

export function CommandRow({
  value,
  keywords,
  label,
  description,
  media,
  badge,
  onSelect,
  onHover,
  trailing,
}: {
  /** What the matcher scores against; the label alone is often too thin. */
  value: string;
  keywords?: string[];
  label: string;
  description: string;
  media: ReactNode;
  /** Where the row lives, when the list is mixing several places. */
  badge?: ReactNode;
  onSelect: () => void;
  onHover: () => void;
  trailing?: ReactNode;
}) {
  return (
    <CommandItem
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      // cmdk drives selection from the keyboard only. Without this the pointer
      // moves over a row and nothing happens, which reads as a dead list.
      onPointerMove={onHover}
      className={cn(
        'gap-3 rounded-lg px-3 py-3 transition-colors duration-100',
        SELECTED_ROW,
      )}
    >
      <IconTile>{media}</IconTile>
      {/* Takes the slack itself. Left to size on content, the free space is
          split between this row's trailing margin and the hidden CheckIcon the
          kit appends, and the trailing mark lands somewhere different on every
          row depending on how long its label is. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] leading-tight font-medium">
            {label}
          </span>
          {badge}
        </span>
        <span className="truncate text-xs leading-tight text-muted-foreground">
          {description}
        </span>
      </span>
      {/* `CommandShortcut` is what makes the kit hide its own trailing
          CheckIcon, which is the other half of the same alignment problem. */}
      {trailing ? (
        <CommandShortcut className="flex shrink-0 items-center gap-1.5 tracking-normal">
          {trailing}
        </CommandShortcut>
      ) : null}
    </CommandItem>
  );
}
