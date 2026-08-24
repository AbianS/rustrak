import type { ColumnFiltersState, RowData } from '@tanstack/react-table';
import {
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { focusRingWithin } from '../../lib/focus';
import { dropIn, interactiveTransition } from '../../lib/motion';
import { tv } from '../../lib/tv';
import { Count } from '../count/count';
import type { DataTableColumnDef, FilterOption } from '../data-table/features';
import {
  type FilterVariants,
  formatFilterQuery,
  parseFilterQuery,
} from '../data-table/query';
import type { IconComponent } from '../icon/icon';
import {
  CloseIcon,
  FacetsIcon,
  ResolveIcon,
  SearchIcon,
} from '../icon/icon-catalog';
import { Kbd } from '../kbd/kbd';
import type { TagTone } from '../tag/tag';

/**
 * The query bar: one line that holds the whole question.
 *
 * Filters live in it as `key:value` chips and free text rides after them, so
 * the bar always reads back as the exact string `parseFilterQuery` accepts --
 * what you see is what a teammate can paste. It edits the same
 * `ColumnFiltersState` the column header panels edit: tick "Warning" in the
 * Level column and a chip appears here; delete the chip and the column's
 * funnel goes out. One state, two views of it.
 *
 * The autocomplete works in two phases, the way GitHub's does. Typing offers
 * the *fields* that can be asked about; choosing one writes `level:` and the
 * popup turns to that field's *values*, ticking live as they are chosen.
 * Free text never needs a phase: whatever no key claims is the search, and
 * Enter sends it.
 */
const queryBar = tv({
  slots: {
    root: 'relative min-w-0 flex-1',
    /*
     * The bar wraps rather than clips. A fixed-height field with
     * `overflow-hidden` chips read fine until a phone: the third chip
     * disappeared with no trace, and what cannot be seen cannot be removed.
     * `min-h` keeps the resting bar at exactly the 36 px it always was; only
     * a second row of chips makes it taller, and the vertical padding is
     * what keeps the wrapped rows off the border.
     */
    field: [
      'flex min-h-control-lg w-full min-w-0 flex-wrap items-center gap-1.5',
      'rounded-md border border-border bg-surface ps-2.5 pe-1.5 py-1',
      'cursor-text',
      interactiveTransition,
      'hover:border-border-strong',
      focusRingWithin,
    ],
    // `contents`: the chips are flex items of the field itself, so they
    // share its wrapping instead of clipping inside a nested row.
    chips: 'contents',
    chip: [
      'flex h-chip max-w-full shrink-0 items-center rounded-xs bg-surface-chip',
      'ps-2 pe-0.5 font-mono text-mono-sm',
      'animate-swap-in motion-reduce:animate-none',
    ],
    chipKey: 'shrink-0 text-fg-subtle',
    // A value longer than the viewport keeps its chip on one line and says
    // the rest with an ellipsis.
    chipValue: 'ms-0.5 min-w-0 truncate text-fg',
    chipRemove: [
      'ms-0.5 flex size-4.5 items-center justify-center rounded-2xs',
      'text-fg-ghost outline-none',
      interactiveTransition,
      'hover:bg-surface-selected hover:text-fg',
      'focus-visible:bg-surface-selected focus-visible:text-fg',
    ],
    // Its own height, not `h-full`: in a wrapped field, full height would be
    // every row at once and the caret would sit in the middle of them.
    input: [
      'h-chip min-w-24 flex-1 bg-transparent text-control text-fg',
      'outline-none placeholder:text-fg-placeholder',
    ],
    clear: [
      'flex size-6 shrink-0 items-center justify-center rounded-sm',
      'text-fg-ghost outline-none',
      interactiveTransition,
      'hover:bg-surface-selected hover:text-fg',
      'focus-visible:bg-surface-selected focus-visible:text-fg',
    ],
    popup: [
      'absolute inset-x-0 top-full z-50 mt-1.5',
      // The list is what scrolls: the keyboard footer stays put, because the
      // person scrolling a long value list is exactly who needs it.
      'flex max-h-80 flex-col overflow-hidden',
      'rounded-lg border border-border bg-surface-floating p-1.25',
      'shadow-overlay',
      dropIn,
    ],
    list: 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto',
    groupLabel: 'px-2.5 pt-2 pb-1 font-mono text-column text-fg-meta uppercase',
    option: [
      'flex h-menu-item shrink-0 cursor-default items-center gap-2.5',
      'rounded-sm px-2.5 text-control text-fg-muted select-none',
      'transition-none outline-none',
      'data-[highlighted=true]:bg-surface-selected data-[highlighted=true]:text-fg',
    ],
    optionIcon: 'shrink-0 text-fg-ghost',
    optionBox: [
      'flex size-3.5 shrink-0 items-center justify-center',
      'rounded-xs border border-border-control text-fg-on-brand',
      'data-[ticked=true]:border-surface-brand data-[ticked=true]:bg-surface-brand',
    ],
    optionDot: 'size-dot shrink-0 rounded-pill',
    optionLabel: 'min-w-0 flex-1 truncate text-start',
    optionHint: 'ms-auto shrink-0 truncate text-fg-ghost text-hint',
    skeleton: 'mx-2.5 my-2 h-3 animate-pulse rounded-xs bg-surface-chip',
    hints: [
      'mt-1 flex shrink-0 items-center gap-3.5 border-border-subtle border-t',
      'px-2.5 pt-2 pb-1 font-mono text-fg-ghost text-mono-sm',
    ],
  },
});

const styles = queryBar();

const TONE_DOT: Record<TagTone, string> = {
  error: 'bg-sev-error',
  warning: 'bg-sev-warning',
  info: 'bg-sev-info',
  brand: 'bg-surface-brand',
  neutral: 'bg-fg-ghost',
};

/** A field the bar can complete: what `key:` means and what it takes. */
export interface QueryField {
  key: string;
  label: string;
  icon?: IconComponent;
  /** Read in the suggestion row: "severity of the issue". */
  description?: string;
  variant: 'options' | 'text' | 'range';
  options?: readonly FilterOption[];
  loadOptions?: () => Promise<FilterOption[]>;
  /** Options only: whether several values can hold at once. Default true. */
  multiple?: boolean;
}

/**
 * The bar's fields, read straight off the table's columns so the two can
 * never disagree about what is filterable or what it is called.
 */
export function queryFieldsFromColumns<TData extends RowData>(
  columns: DataTableColumnDef<TData>[],
): QueryField[] {
  const fields: QueryField[] = [];
  for (const column of columns) {
    const meta = column.meta;
    const id = column.id;
    if (!meta?.filter || !id) continue;
    const label =
      meta.label ?? (typeof column.header === 'string' ? column.header : id);
    if (meta.filter.variant === 'options') {
      fields.push({
        key: id,
        label,
        icon: meta.icon,
        variant: 'options',
        options: meta.filter.options,
        loadOptions: meta.filter.loadOptions,
        multiple: meta.filter.multiple,
      });
    } else {
      fields.push({
        key: id,
        label,
        icon: meta.icon,
        variant: meta.filter.variant,
      });
    }
  }
  return fields;
}

/** The variants map the codecs in `query.ts` take, from the same fields. */
export function variantsFromFields(fields: QueryField[]): FilterVariants {
  return Object.fromEntries(fields.map((field) => [field.key, field.variant]));
}

type Suggestion =
  | { kind: 'field'; field: QueryField }
  | { kind: 'value'; field: QueryField; option: FilterOption }
  | { kind: 'search'; text: string };

export interface QueryBarProps {
  fields: QueryField[];
  filters: ColumnFiltersState;
  search: string;
  onChange: (next: { filters: ColumnFiltersState; search: string }) => void;
  placeholder?: string;
  /** Named in the field's accessible name; there may be several bars. */
  label?: string;
  className?: string;
}

export function QueryBar({
  fields,
  filters,
  search,
  onChange,
  placeholder = 'Filter by key:value, or search…',
  label = 'Filter and search',
  className,
}: QueryBarProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(search);
  const [open, setOpen] = useState(false);
  /*
   * The field whose values the popup is offering, held as state rather than
   * as text. Choosing "Level" used to write `level:` into the input to carry
   * the phase; the token then sat there, fixed, beside every chip it
   * produced. The phase is not prose, so it no longer lives in the prose --
   * the input stays clean and the popup stays on the field's values until
   * Escape, blur or a single-choice pick ends it. Typing `level:` by hand
   * still works: the token form is the same question asked in writing.
   */
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const [loadedOptions, setLoadedOptions] = useState<
    Record<string, FilterOption[]>
  >({});

  const variants = useMemo(() => variantsFromFields(fields), [fields]);

  /*
   * The draft belongs to the bar while it is being typed, but the committed
   * search belongs to the owner: when it changes from outside (a cleared
   * query, a navigated URL), the bar must show it.
   */
  const lastSearch = useRef(search);
  if (search !== lastSearch.current) {
    lastSearch.current = search;
    setDraft(search);
  }

  /* --- Phase detection --------------------------------------------------- */

  const tokenMatch = draft.match(/(^|\s)([A-Za-z0-9_.-]+):(\S*)$/);
  const typedField = tokenMatch
    ? fields.find((field) => field.key === tokenMatch[2])
    : undefined;
  const pickedField = pickedKey
    ? fields.find((field) => field.key === pickedKey)
    : undefined;
  const activeField = pickedField ?? typedField;

  /*
   * Only the word under the caret is being completed; whatever stands before
   * it is already said and survives the completion. So `timeout lev` offers
   * Level, and taking it keeps `timeout` -- the fragment is replaced,
   * never appended to.
   */
  const fragmentMatch = draft.match(/(^|\s)(\S*)$/);
  const fragment = fragmentMatch?.[2] ?? '';
  const fragmentPrefix = draft.slice(
    0,
    (fragmentMatch?.index ?? 0) + (fragmentMatch?.[1]?.length ?? 0),
  );

  // With a picked field, whatever is being typed narrows its values.
  const valueFragment = pickedField
    ? fragment
    : typedField
      ? (tokenMatch?.[3] ?? '')
      : '';
  const fieldNeedle = activeField ? '' : fragment.toLowerCase();
  const prefix =
    !pickedField && typedField
      ? draft.slice(
          0,
          (tokenMatch?.index ?? 0) + (tokenMatch?.[1]?.length ?? 0),
        )
      : fragmentPrefix;

  const fieldOptions = activeField
    ? (activeField.options ?? loadedOptions[activeField.key])
    : undefined;
  const optionsPending = Boolean(
    activeField?.loadOptions &&
      !activeField.options &&
      !loadedOptions[activeField.key],
  );

  const pendingKey = optionsPending ? activeField?.key : undefined;
  const pendingLoad = optionsPending ? activeField?.loadOptions : undefined;
  useEffect(() => {
    if (!pendingKey || !pendingLoad) return;
    let cancelled = false;
    pendingLoad()
      .then((options) => {
        if (!cancelled) {
          setLoadedOptions((previous) => ({
            ...previous,
            [pendingKey]: options,
          }));
        }
      })
      .catch(() => {
        // An empty list ends the skeleton and reads as "nothing to offer".
        if (!cancelled) {
          setLoadedOptions((previous) => ({ ...previous, [pendingKey]: [] }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pendingKey, pendingLoad]);

  /* --- Suggestions ------------------------------------------------------- */

  const selectedValues = (key: string): string[] => {
    const filter = filters.find((f) => f.id === key);
    return Array.isArray(filter?.value) ? (filter.value as string[]) : [];
  };

  const suggestions = useMemo<Suggestion[]>(() => {
    if (activeField) {
      if (activeField.variant !== 'options') return [];
      const needle = valueFragment.split(',').pop()?.toLowerCase() ?? '';
      return (fieldOptions ?? [])
        .filter(
          (option) =>
            !needle ||
            option.label.toLowerCase().includes(needle) ||
            option.value.toLowerCase().includes(needle),
        )
        .map((option) => ({ kind: 'value', field: activeField, option }));
    }

    const matches = fields
      .filter(
        (field) =>
          !fieldNeedle ||
          field.label.toLowerCase().includes(fieldNeedle) ||
          field.key.toLowerCase().includes(fieldNeedle),
      )
      .map<Suggestion>((field) => ({ kind: 'field', field }));

    // The search row rides last: when fields match what was typed, the
    // structured question is the better default under Enter.
    return draft.trim()
      ? [...matches, { kind: 'search', text: draft.trim() }]
      : matches;
  }, [activeField, valueFragment, fieldOptions, draft, fields]);

  // Reaching past the end after a list shrinks parks on the last row.
  const highlightIndex = Math.min(
    highlighted,
    Math.max(suggestions.length - 1, 0),
  );

  /* --- Commits ----------------------------------------------------------- */

  function commitDraft(next: string) {
    const parsed = parseFilterQuery(next, variants);
    const untouched = filters.filter(
      (filter) => !parsed.filters.some((f) => f.id === filter.id),
    );
    onChange({
      filters: [...untouched, ...parsed.filters],
      search: parsed.search,
    });
    setDraft(parsed.search);
  }

  function toggleValue(field: QueryField, option: FilterOption) {
    const selected = selectedValues(field.key);
    const has = selected.includes(option.value);
    const multiple = field.multiple ?? true;
    const nextValues = multiple
      ? has
        ? selected.filter((value) => value !== option.value)
        : [...selected, option.value]
      : has
        ? []
        : [option.value];

    const rest = filters.filter((filter) => filter.id !== field.key);
    onChange({
      filters: nextValues.length
        ? [...rest, { id: field.key, value: nextValues }]
        : rest,
      search,
    });

    /*
     * The typed fragment leaves the draft the moment it is real as a chip.
     * A multi-value field stays picked so the list stays on its values --
     * `level:error,fatal` is two ticks in a row, not two round trips through
     * the field list -- but the phase lives in `pickedKey`, never as a
     * `key:` parked in the input.
     */
    setDraft(prefix.trimEnd() ? `${prefix.trimEnd()} ` : '');
    if (multiple) {
      setPickedKey(field.key);
    } else {
      setPickedKey(null);
      setOpen(false);
    }
    inputRef.current?.focus();
  }

  function apply(suggestion: Suggestion) {
    if (suggestion.kind === 'field') {
      const kept = prefix.trimEnd() ? `${prefix.trimEnd()} ` : '';
      if (suggestion.field.variant === 'options') {
        // The phase is state; the input hands over its fragment and stays
        // clean while the popup turns to the field's values.
        setPickedKey(suggestion.field.key);
        setDraft(kept);
      } else {
        // A text or range value is typed, so the token is started in
        // writing: `events:` waiting for its `100..500`.
        setDraft(`${kept}${suggestion.field.key}:`);
      }
      setHighlighted(0);
      inputRef.current?.focus();
      return;
    }
    if (suggestion.kind === 'value') {
      toggleValue(suggestion.field, suggestion.option);
      return;
    }
    commitDraft(draft);
    setOpen(false);
    setPickedKey(null);
  }

  function removeFilter(key: string) {
    onChange({
      filters: filters.filter((filter) => filter.id !== key),
      search,
    });
    inputRef.current?.focus();
  }

  function clearAll() {
    onChange({ filters: [], search: '' });
    setDraft('');
    inputRef.current?.focus();
  }

  /* --- Keyboard ---------------------------------------------------------- */

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next =
        (highlightIndex + delta + suggestions.length) %
        Math.max(suggestions.length, 1);
      setHighlighted(next);
      // The list scrolls, the input keeps focus: the highlighted row has to
      // be brought along by hand.
      document
        .getElementById(`${id}-option-${next}`)
        ?.scrollIntoView({ block: 'nearest' });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const current = suggestions[highlightIndex];
      if (open && current) {
        apply(current);
      } else {
        commitDraft(draft);
        setOpen(false);
        setPickedKey(null);
      }
      return;
    }

    if (event.key === 'Tab' && open) {
      const current = suggestions[highlightIndex];
      if (current && current.kind === 'field') {
        event.preventDefault();
        apply(current);
      }
      return;
    }

    if (event.key === 'Escape') {
      if (open) {
        setOpen(false);
        setPickedKey(null);
      } else if (draft) {
        setDraft('');
      }
      return;
    }

    if (event.key === 'Backspace' && draft === '') {
      // First step out of the picked field, then start eating chips.
      if (pickedKey) {
        setPickedKey(null);
        return;
      }
      const last = filters[filters.length - 1];
      if (last) removeFilter(last.id);
    }
  }

  /* --- Rendering --------------------------------------------------------- */

  const chips = filters
    .map((filter) => {
      const field = fields.find((f) => f.key === filter.id);
      if (!field) return null;
      const text = formatFilterQuery([filter], '', variants);
      const value = text.startsWith(`${filter.id}:`)
        ? text.slice(filter.id.length + 1)
        : text;
      if (!value) return null;
      return { key: filter.id, label: field.label, value };
    })
    .filter((chip) => chip !== null);

  const listboxId = `${id}-listbox`;
  const showClear = chips.length > 0 || search !== '' || draft !== '';

  return (
    <div ref={rootRef} className={styles.root({ className })}>
      {/* The field is a click target for the input inside it -- the whole
          bar must feel like one text field, chips included. */}
      <div className={styles.field()} onClick={() => inputRef.current?.focus()}>
        <SearchIcon size="lg" className="shrink-0 text-fg-ghost" />

        {chips.length ? (
          <span className={styles.chips()}>
            {chips.map((chip) => (
              <span key={`${chip.key}:${chip.value}`} className={styles.chip()}>
                <span className={styles.chipKey()}>{chip.key}:</span>
                <span className={styles.chipValue()}>{chip.value}</span>
                <button
                  type="button"
                  aria-label={`Remove ${chip.label} filter`}
                  className={styles.chipRemove()}
                  onClick={() => removeFilter(chip.key)}
                >
                  <CloseIcon size="sm" aria-hidden="true" />
                </button>
              </span>
            ))}
          </span>
        ) : null}

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && suggestions[highlightIndex]
              ? `${id}-option-${highlightIndex}`
              : undefined
          }
          aria-autocomplete="list"
          aria-label={label}
          value={draft}
          placeholder={
            pickedField
              ? `${pickedField.label}…`
              : chips.length
                ? 'Add a filter…'
                : placeholder
          }
          autoComplete="off"
          spellCheck={false}
          className={styles.input()}
          onChange={(event) => {
            setDraft(event.target.value);
            setHighlighted(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            // Leaving for the popup is not leaving. And leaving commits
            // nothing: half a question walked away from is not a question.
            if (!rootRef.current?.contains(event.relatedTarget)) {
              setOpen(false);
              setPickedKey(null);
            }
          }}
          onKeyDown={onKeyDown}
        />

        {showClear ? (
          <button
            type="button"
            aria-label="Clear filters and search"
            className={styles.clear()}
            onClick={clearAll}
          >
            <CloseIcon size="md" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className={styles.popup()} data-side="bottom">
          {activeField && activeField.variant === 'options' ? (
            <div className={styles.groupLabel()}>{activeField.label}</div>
          ) : null}
          {!activeField && suggestions.some((s) => s.kind === 'field') ? (
            <div className={styles.groupLabel()}>Filter by</div>
          ) : null}

          <div className={styles.list()}>
            {optionsPending ? (
              <div aria-hidden="true">
                {[0, 1, 2].map((line) => (
                  <div key={line} className={styles.skeleton()} />
                ))}
              </div>
            ) : null}

            <div
              role="listbox"
              id={listboxId}
              aria-label="Suggestions"
              aria-busy={optionsPending || undefined}
            >
              {suggestions.map((suggestion, index) => {
                const highlightedRow = index === highlightIndex;
                const shared = {
                  id: `${id}-option-${index}`,
                  'data-highlighted': highlightedRow,
                  className: styles.option(),
                  onMouseEnter: () => setHighlighted(index),
                  // Fires before the input's blur: the click must win.
                  onMouseDown: (event: ReactMouseEvent) =>
                    event.preventDefault(),
                  onClick: () => apply(suggestion),
                };

                if (suggestion.kind === 'field') {
                  const Icon = suggestion.field.icon ?? FacetsIcon;
                  return (
                    <div
                      key={`field-${suggestion.field.key}`}
                      {...shared}
                      role="option"
                      // Steered from the input via aria-activedescendant.
                      tabIndex={-1}
                      aria-selected={false}
                    >
                      <Icon size="lg" className={styles.optionIcon()} />
                      <span className={styles.optionLabel()}>
                        {suggestion.field.label}
                      </span>
                      <span className={styles.optionHint()}>
                        {suggestion.field.description ??
                          `${suggestion.field.key}:`}
                      </span>
                    </div>
                  );
                }

                if (suggestion.kind === 'value') {
                  const ticked = selectedValues(suggestion.field.key).includes(
                    suggestion.option.value,
                  );
                  return (
                    <div
                      key={`value-${suggestion.option.value}`}
                      {...shared}
                      role="option"
                      tabIndex={-1}
                      aria-selected={ticked}
                    >
                      <span
                        aria-hidden="true"
                        data-ticked={ticked}
                        className={styles.optionBox()}
                      >
                        {ticked ? (
                          <ResolveIcon size="sm" aria-hidden="true" />
                        ) : null}
                      </span>
                      {suggestion.option.tone ? (
                        <span
                          aria-hidden="true"
                          className={styles.optionDot({
                            className: TONE_DOT[suggestion.option.tone],
                          })}
                        />
                      ) : null}
                      <span className={styles.optionLabel()}>
                        {suggestion.option.label}
                      </span>
                      {suggestion.option.hint ? (
                        <span className={styles.optionHint()}>
                          {suggestion.option.hint}
                        </span>
                      ) : null}
                      <Count>{suggestion.option.count}</Count>
                    </div>
                  );
                }

                return (
                  <div
                    key="search"
                    {...shared}
                    role="option"
                    tabIndex={-1}
                    aria-selected={false}
                  >
                    <SearchIcon size="lg" className={styles.optionIcon()} />
                    <span className={styles.optionLabel()}>
                      Search “{suggestion.text}”
                    </span>
                    <Kbd>⏎</Kbd>
                  </div>
                );
              })}
            </div>

            {activeField && activeField.variant === 'range' ? (
              <div className={styles.option()}>
                <span className={styles.optionLabel()}>
                  Type a range: {activeField.key}:100..500, then
                </span>
                <Kbd>⏎</Kbd>
              </div>
            ) : null}
            {activeField && activeField.variant === 'text' ? (
              <div className={styles.option()}>
                <span className={styles.optionLabel()}>Type a value, then</span>
                <Kbd>⏎</Kbd>
              </div>
            ) : null}

            {!optionsPending &&
            suggestions.length === 0 &&
            activeField?.variant === 'options' ? (
              <div className="px-2.5 py-3 text-center text-control text-fg-ghost">
                Nothing matches
              </div>
            ) : null}
          </div>

          <span aria-hidden="true" className={styles.hints()}>
            <span>↑↓ navigate</span>
            <span>⏎ select</span>
            <span>esc closes</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

QueryBar.displayName = 'QueryBar';
