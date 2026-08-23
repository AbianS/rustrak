import type { Column, RowData } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { focusRingWithin } from '../../lib/focus';
import { interactiveTransition } from '../../lib/motion';
import { tv } from '../../lib/tv';
import { Count } from '../count/count';
import { ResolveIcon, SearchIcon } from '../icon/icon-catalog';
import type { TagTone } from '../tag/tag';
import type { DataTableFeatures, FilterOption } from './features';

/**
 * The filter half of a column header panel: what changes with the column's
 * data type. An enum column offers its values, a numeric column offers
 * bounds, a text column offers a match. The sort half lives in
 * `column-header.tsx`; this file only knows how to ask about values.
 *
 * Every change applies immediately. A filter panel with an Apply button makes
 * the reader describe the whole question before seeing any answer; applying
 * on each tick lets the list answer while the question is still being formed,
 * which is how the query bar behaves too. Immediate does not mean noisy: the
 * inputs that type (text, bounds) commit on Enter or blur, not per keystroke,
 * because every commit is a server round trip.
 */
const filterPanel = tv({
  slots: {
    section: 'flex flex-col p-1.25',
    /*
     * The search field sits inside the panel on its own row. It filters the
     * option list, not the table: with forty releases the list needs its own
     * finder before the finder is any use.
     */
    field: [
      'mx-1 mt-1 mb-1.5 flex h-control-sm items-center gap-1.5 rounded-md',
      'border border-border-field bg-canvas px-2',
      interactiveTransition,
      focusRingWithin,
    ],
    input: [
      'h-full w-full min-w-0 bg-transparent text-control text-fg',
      'outline-none placeholder:text-fg-placeholder',
    ],
    option: [
      'group/option flex h-menu-item shrink-0 cursor-default items-center',
      'gap-2.5 rounded-sm px-2.5 text-control text-fg-muted select-none',
      'transition-none outline-none',
      'hover:bg-surface-selected hover:text-fg',
      'focus-visible:bg-surface-selected focus-visible:text-fg',
      'aria-pressed:text-fg',
    ],
    /*
     * The tick box is drawn, not a `Checkbox`: the row itself is the button,
     * and a real checkbox inside it would be a control inside a control --
     * two tab stops, two announcements, one action.
     */
    box: [
      'flex size-3.5 shrink-0 items-center justify-center',
      'rounded-xs border border-border-control text-fg-on-brand',
      interactiveTransition,
      'group-aria-pressed/option:border-surface-brand',
      'group-aria-pressed/option:bg-surface-brand',
    ],
    dot: 'size-dot shrink-0 rounded-pill',
    label: 'min-w-0 flex-1 truncate text-start',
    empty: 'px-2.5 py-3 text-center text-control text-fg-ghost',
    skeleton: 'mx-2.5 my-2 h-3 animate-pulse rounded-xs bg-surface-chip',
  },
});

const styles = filterPanel();

/*
 * A static map, never `bg-${tone}`: Tailwind extracts class names from the
 * source text, so a composed name is a rule that is silently not generated.
 */
const TONE_DOT: Record<TagTone, string> = {
  error: 'bg-sev-error',
  warning: 'bg-sev-warning',
  info: 'bg-sev-info',
  brand: 'bg-surface-brand',
  neutral: 'bg-fg-ghost',
};

interface PanelProps<TData extends RowData> {
  column: Column<DataTableFeatures, TData, unknown>;
}

/* --- Options ------------------------------------------------------------- */

export function OptionsFilterPanel<TData extends RowData>({
  column,
}: PanelProps<TData>) {
  const spec = column.columnDef.meta?.filter;
  const [loaded, setLoaded] = useState<FilterOption[] | null>(null);
  const [search, setSearch] = useState('');

  const loadOptions =
    spec?.variant === 'options' ? spec.loadOptions : undefined;
  useEffect(() => {
    if (!loadOptions) return;
    let cancelled = false;
    loadOptions().then((options) => {
      if (!cancelled) setLoaded(options);
    });
    return () => {
      cancelled = true;
    };
  }, [loadOptions]);

  if (spec?.variant !== 'options') return null;

  const options = spec.options ?? loaded;
  const multiple = spec.multiple ?? true;
  const selected = (column.getFilterValue() as string[] | undefined) ?? [];

  const visible = options?.filter(
    (option) =>
      !search ||
      option.label.toLowerCase().includes(search.toLowerCase()) ||
      option.value.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(value: string) {
    const has = selected.includes(value);
    const next = multiple
      ? has
        ? selected.filter((v) => v !== value)
        : [...selected, value]
      : has
        ? []
        : [value];
    column.setFilterValue(next.length ? next : undefined);
  }

  return (
    <div className={styles.section()}>
      {options && options.length > 7 ? (
        <div className={styles.field()}>
          <SearchIcon size="md" className="shrink-0 text-fg-ghost" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter values…"
            aria-label="Filter values"
            className={styles.input()}
          />
        </div>
      ) : null}

      {/* The skeleton holds the panel at roughly its final size, so the list
          arriving does not shove the pointer off what it was about to click. */}
      {!options
        ? [0, 1, 2].map((line) => (
            <div key={line} aria-hidden="true" className={styles.skeleton()} />
          ))
        : null}

      {visible?.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected.includes(option.value)}
          onClick={() => toggle(option.value)}
          className={styles.option()}
        >
          <span aria-hidden="true" className={styles.box()}>
            {selected.includes(option.value) ? (
              <ResolveIcon size="sm" aria-hidden="true" />
            ) : null}
          </span>
          {option.tone ? (
            <span
              aria-hidden="true"
              className={styles.dot({ className: TONE_DOT[option.tone] })}
            />
          ) : null}
          <span className={styles.label()}>{option.label}</span>
          <Count>{option.count}</Count>
        </button>
      ))}

      {visible && visible.length === 0 ? (
        <div className={styles.empty()}>Nothing matches</div>
      ) : null}
    </div>
  );
}

OptionsFilterPanel.displayName = 'OptionsFilterPanel';

/* --- Text ---------------------------------------------------------------- */

export function TextFilterPanel<TData extends RowData>({
  column,
}: PanelProps<TData>) {
  const spec = column.columnDef.meta?.filter;
  const applied = (column.getFilterValue() as string | undefined) ?? '';
  const [draft, setDraft] = useState(applied);

  if (spec?.variant !== 'text') return null;

  function commit() {
    column.setFilterValue(draft || undefined);
  }

  return (
    <div className={styles.section()}>
      <div className={styles.field()}>
        <SearchIcon size="md" className="shrink-0 text-fg-ghost" />
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
          placeholder={spec.placeholder ?? 'Contains…'}
          aria-label={spec.placeholder ?? 'Filter text'}
          className={styles.input()}
        />
      </div>
    </div>
  );
}

TextFilterPanel.displayName = 'TextFilterPanel';

/* --- Range --------------------------------------------------------------- */

export function RangeFilterPanel<TData extends RowData>({
  column,
}: PanelProps<TData>) {
  const spec = column.columnDef.meta?.filter;
  const applied =
    (column.getFilterValue() as [number | null, number | null] | undefined) ??
    ([null, null] as [number | null, number | null]);
  const [min, setMin] = useState(applied[0]?.toString() ?? '');
  const [max, setMax] = useState(applied[1]?.toString() ?? '');

  if (spec?.variant !== 'range') return null;

  function commit() {
    const low = min === '' ? null : Number(min);
    const high = max === '' ? null : Number(max);
    if (
      (low !== null && Number.isNaN(low)) ||
      (high !== null && Number.isNaN(high))
    ) {
      return;
    }
    column.setFilterValue(
      low === null && high === null ? undefined : [low, high],
    );
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') commit();
  }

  return (
    <div className={styles.section()}>
      <div className="flex items-center gap-2 px-1 py-1">
        <div className={styles.field({ className: 'mx-0 my-0 flex-1' })}>
          <input
            type="number"
            inputMode="numeric"
            value={min}
            min={spec.min}
            max={spec.max}
            onChange={(event) => setMin(event.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            placeholder="Min"
            aria-label={`Minimum${spec.unit ? ` (${spec.unit})` : ''}`}
            className={styles.input()}
          />
        </div>
        <span aria-hidden="true" className="text-fg-ghost text-hint">
          –
        </span>
        <div className={styles.field({ className: 'mx-0 my-0 flex-1' })}>
          <input
            type="number"
            inputMode="numeric"
            value={max}
            min={spec.min}
            max={spec.max}
            onChange={(event) => setMax(event.target.value)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            placeholder="Max"
            aria-label={`Maximum${spec.unit ? ` (${spec.unit})` : ''}`}
            className={styles.input()}
          />
        </div>
        {/* Decoration: the unit already lives in each input's accessible name. */}
        {spec.unit ? (
          <span aria-hidden="true" className="shrink-0 text-fg-ghost text-hint">
            {spec.unit}
          </span>
        ) : null}
      </div>
    </div>
  );
}

RangeFilterPanel.displayName = 'RangeFilterPanel';
