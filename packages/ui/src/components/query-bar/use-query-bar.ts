import type { ColumnFiltersState } from '@tanstack/react-table';
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FilterOption } from '../data-table/features';
import { formatFilterQuery, parseFilterQuery } from '../data-table/query';
import {
  detectPhase,
  type QueryField,
  variantsFromFields,
} from './query-bar-parts';

/**
 * The values a field holds once one option is ticked.
 *
 * Ticking the standing choice of a single-choice field clears it rather than
 * re-picking it: the same "asking twice withdraws the question" rule the
 * column headers use for sort.
 */
function nextSelection(
  selected: string[],
  value: string,
  multiple: boolean,
): string[] {
  const has = selected.includes(value);
  if (!multiple) return has ? [] : [value];
  return has ? selected.filter((v) => v !== value) : [...selected, value];
}

export type Suggestion =
  | { kind: 'field'; field: QueryField }
  | { kind: 'value'; field: QueryField; option: FilterOption }
  | { kind: 'search'; text: string };

interface UseQueryBarOptions {
  fields: QueryField[];
  filters: ColumnFiltersState;
  search: string;
  onChange: (next: { filters: ColumnFiltersState; search: string }) => void;
}

/**
 * The bar's whole behaviour: phase detection, suggestions, commits and
 * keyboard handling. Split from `QueryBar` so the component is left with only
 * what it renders -- this owns what it means.
 */
export function useQueryBar({
  fields,
  filters,
  search,
  onChange,
}: UseQueryBarOptions) {
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
  /*
   * The key of the field whose load most recently rejected. Kept apart from
   * `loadedOptions` on purpose: caching `[]` there would read as "loaded, and
   * empty" forever, so a transient failure could never be retried. Leaving
   * and returning to the field clears it, because that is what starts a new
   * attempt below.
   */
  const [failedKey, setFailedKey] = useState<string | null>(null);

  const variants = useMemo(() => variantsFromFields(fields), [fields]);

  /*
   * The draft belongs to the bar while it is being typed, but the committed
   * search belongs to the owner: when it changes from outside (a cleared
   * query, a navigated URL), the bar must show it.
   */
  const lastSearch = useRef(search);
  if (search !== lastSearch.current) {
    // React's own adjusting-state-during-render pattern: an effect here would
    // paint one frame of stale draft before correcting it.
    // react-doctor-disable-next-line react-doctor/no-ref-current-in-render
    lastSearch.current = search;
    setDraft(search);
  }

  /* --- Phase detection --------------------------------------------------- */

  const { pickedField, activeField, valueFragment, fieldNeedle, prefix } =
    detectPhase(draft, fields, pickedKey);

  const fieldOptions = activeField
    ? (activeField.options ?? loadedOptions[activeField.key])
    : undefined;
  // Drives the fetch: unconditioned on a prior failure, so leaving the field
  // and coming back -- which changes this key -- retries automatically.
  const pendingKey =
    activeField?.loadOptions && !activeField.options && !fieldOptions
      ? activeField.key
      : undefined;
  const pendingLoad = pendingKey ? activeField?.loadOptions : undefined;
  // Drives the skeleton: false once a failure has already been recorded, so
  // it does not spin forever waiting for an attempt that already ended.
  const optionsPending = Boolean(pendingKey) && failedKey !== pendingKey;

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
        if (!cancelled) setFailedKey(pendingKey);
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
      return (fieldOptions ?? []).reduce<Suggestion[]>((matches, option) => {
        if (
          !needle ||
          option.label.toLowerCase().includes(needle) ||
          option.value.toLowerCase().includes(needle)
        ) {
          matches.push({ kind: 'value', field: activeField, option });
        }
        return matches;
      }, []);
    }

    const matches = fields.reduce<Suggestion[]>((acc, field) => {
      if (
        !fieldNeedle ||
        field.label.toLowerCase().includes(fieldNeedle) ||
        field.key.toLowerCase().includes(fieldNeedle)
      ) {
        acc.push({ kind: 'field', field });
      }
      return acc;
    }, []);

    // The search row rides last: when fields match what was typed, the
    // structured question is the better default under Enter.
    return draft.trim()
      ? [...matches, { kind: 'search', text: draft.trim() }]
      : matches;
  }, [activeField, valueFragment, fieldOptions, draft, fields, fieldNeedle]);

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
    const multiple = field.multiple ?? true;
    const nextValues = nextSelection(
      selectedValues(field.key),
      option.value,
      multiple,
    );

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

  /** Moves the highlight and brings the row into view. Opens the list first. */
  function moveHighlight(delta: 1 | -1) {
    if (!open) {
      setOpen(true);
      return;
    }

    const next =
      (highlightIndex + delta + suggestions.length) %
      Math.max(suggestions.length, 1);
    setHighlighted(next);

    // The list scrolls, the input keeps focus: the highlighted row has to be
    // brought along by hand.
    document
      .getElementById(`${id}-option-${next}`)
      ?.scrollIntoView({ block: 'nearest' });
  }

  /** Enter takes the highlighted suggestion, or commits what is written. */
  function commitOrApply() {
    const current = suggestions[highlightIndex];
    if (open && current) {
      apply(current);
      return;
    }

    commitDraft(draft);
    setOpen(false);
    setPickedKey(null);
  }

  /**
   * Tab completes a field name and nothing else.
   *
   * On a value or the search row it falls through to the browser, because
   * there Tab is the only way out of the bar.
   */
  function completeField(event: KeyboardEvent<HTMLInputElement>) {
    const current = suggestions[highlightIndex];
    if (current?.kind !== 'field') return;

    event.preventDefault();
    apply(current);
  }

  /** Escape closes the list; with the list already closed, it clears. */
  function dismiss() {
    if (open) {
      setOpen(false);
      setPickedKey(null);
      return;
    }
    if (!draft) return;

    // The popup is already closed, so this draft is exactly what is committed
    // (nothing has been typed since). Clearing only the draft would leave the
    // table filtered by search the bar no longer shows.
    setDraft('');
    if (search) onChange({ filters, search: '' });
  }

  /** Backspace on an empty draft steps back out of the phase, then eats chips. */
  function stepBack() {
    if (pickedKey) {
      setPickedKey(null);
      return;
    }

    const last = filters[filters.length - 1];
    if (last) removeFilter(last.id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveHighlight(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveHighlight(-1);
        break;
      case 'Enter':
        event.preventDefault();
        commitOrApply();
        break;
      case 'Tab':
        if (open) completeField(event);
        break;
      case 'Escape':
        dismiss();
        break;
      case 'Backspace':
        if (draft === '') stepBack();
        break;
    }
  }

  /* --- Rendering ----------------------------------------------------------
   * Everything below is data the render still needs, not behaviour.
   */

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
  // Hoisted out of the suggestion loop: every "value" row checks membership.
  const activeFieldSelected = new Set(
    activeField ? selectedValues(activeField.key) : [],
  );

  return {
    id,
    inputRef,
    rootRef,
    draft,
    setDraft,
    open,
    setOpen,
    pickedField,
    setPickedKey,
    activeField,
    highlighted,
    setHighlighted,
    highlightIndex,
    suggestions,
    optionsPending,
    activeFieldSelected,
    chips,
    listboxId,
    showClear,
    apply,
    removeFilter,
    clearAll,
    onKeyDown,
  };
}
