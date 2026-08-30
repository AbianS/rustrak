import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
} from '@tanstack/react-table';
import type { ColumnFilterSpec } from './features';

/**
 * Everything about a table that belongs in the URL: what is filtered, what is
 * sorted, which page. Share the address and the other person sees your list.
 *
 * Selection and column visibility are deliberately not here. A selection is a
 * gesture, not a place -- restoring "3 rows ticked" from a pasted link would
 * tick rows the reader never chose. Visibility is a personal reading
 * preference, and personal preferences do not travel.
 *
 * The package never touches the URL itself: the app owns the router, whatever
 * it is. These are the shapes plus a pair of pure codecs, `parseTableQuery`
 * and `serializeTableQuery`, so every app writes the same URLs without any of
 * them depending on how the others navigate.
 */
export interface DataTableQuery {
  sorting: SortingState;
  filters: ColumnFiltersState;
  /** Free text: whatever was typed that no `key:` claimed. */
  search: string;
  pagination: PaginationState;
}

/**
 * What the filter half of a column's value looks like in state, by variant:
 * `options` holds `string[]`, `text` holds `string`, `range` holds
 * `[min, max]` with `null` for an open end.
 */
export type FilterVariants = Record<string, ColumnFilterSpec['variant']>;

export const DEFAULT_PAGE_SIZE = 50;

export function emptyTableQuery(
  pageSize: number = DEFAULT_PAGE_SIZE,
): DataTableQuery {
  return {
    sorting: [],
    filters: [],
    search: '',
    pagination: { pageIndex: 0, pageSize },
  };
}

/* --- The q string -------------------------------------------------------- */

/*
 * One string carries the filters and the free text: `level:error,fatal
 * release:2.1.0 timeout`. It is the same string the query bar edits, which is
 * the point -- the URL is the bar's value, so copying the address copies the
 * search, and there is no second syntax to learn.
 */

const TOKEN = /^([A-Za-z0-9_.-]+):(.*)$/;

/**
 * Splits on spaces, except inside double quotes: `level:"not found"`. A
 * backslash escapes a quote or another backslash inside the quoted section,
 * so `level:"say \"hi\""` keeps its embedded quotes rather than ending early.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (
      quoted &&
      char === '\\' &&
      (input[i + 1] === '"' || input[i + 1] === '\\')
    ) {
      current += input[i + 1];
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ' ' && !quoted) {
      if (current) tokens.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

/** A space or a quote forces quoting; a bare quote or backslash would else read as syntax. */
function needsQuoting(value: string): boolean {
  return /[\s"\\]/.test(value);
}

function quoteValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function parseRange(raw: string): [number | null, number | null] | null {
  const parts = raw.split('..');
  if (parts.length !== 2) return null;
  const min = parts[0] === '' ? null : Number(parts[0]);
  const max = parts[1] === '' ? null : Number(parts[1]);
  if (min !== null && Number.isNaN(min)) return null;
  if (max !== null && Number.isNaN(max)) return null;
  if (min === null && max === null) return null;
  return [min, max];
}

/** A value that has to survive a round trip through the string is quoted. */
function quoted(value: string): string {
  return needsQuoting(value) ? quoteValue(value) : value;
}

/**
 * What one token turned out to be.
 *
 * `drop` is the third answer the two obvious ones cannot express: a token that
 * is neither a usable filter nor prose worth carrying. Naming it is what keeps
 * the variants below able to disagree about which of the three a failed parse
 * deserves, in one visible place rather than by omission.
 */
type ParsedValue =
  | { kind: 'filter'; value: unknown }
  | { kind: 'text' }
  | { kind: 'drop' };

/** A {@link ParsedValue} once the key it belongs to is known. */
type ParsedToken =
  | { kind: 'filter'; id: string; value: unknown }
  | { kind: 'text' }
  | { kind: 'drop' };

/**
 * How one variant crosses between the string and the filter state.
 *
 * Both directions live together because they are one format described twice,
 * and when they sat in two `variant` chains in two functions they had already
 * drifted: nothing made a value the formatter wrote parse back to itself.
 */
interface FilterCodec {
  /** The state value for the text after the colon. */
  parse: (raw: string) => ParsedValue;
  /** The text after the colon for a state value, or `null` if it says nothing. */
  format: (value: unknown) => string | null;
}

const optionsCodec: FilterCodec = {
  parse: (raw) => {
    const values = raw.split(',').filter(Boolean);
    // `level:,,` names no option and is not prose either: the user reached for
    // a filter and gave it nothing.
    return values.length ? { kind: 'filter', value: values } : { kind: 'drop' };
  },

  format: (value) =>
    Array.isArray(value) && value.length ? value.join(',') : null,
};

const rangeCodec: FilterCodec = {
  parse: (raw) => {
    const range = parseRange(raw);
    // Unlike a malformed option list, `events:oops` may well be prose -- it is
    // a plausible start of a pasted line -- so it is kept rather than dropped.
    return range ? { kind: 'filter', value: range } : { kind: 'text' };
  },

  format: (value) => {
    if (!Array.isArray(value)) return null;
    const [min, max] = value as [number | null, number | null];
    if (min === null && max === null) return null;
    return `${min ?? ''}..${max ?? ''}`;
  },
};

const textCodec: FilterCodec = {
  parse: (raw) => ({ kind: 'filter', value: raw }),

  format: (value) =>
    typeof value === 'string' && value ? quoted(value) : null,
};

const CODECS: Record<ColumnFilterSpec['variant'], FilterCodec> = {
  options: optionsCodec,
  range: rangeCodec,
  text: textCodec,
};

/** One token, resolved against the columns this table can actually filter. */
function parseToken(token: string, variants: FilterVariants): ParsedToken {
  const match = token.match(TOKEN);
  const id = match?.[1];
  const raw = match?.[2];
  const variant = id ? variants[id] : undefined;

  // A `key:` the table has no filterable column for stays free text rather
  // than becoming a phantom filter: `error:` at the start of a pasted stack
  // trace is prose, not a request.
  if (id === undefined || raw === undefined || !variant)
    return { kind: 'text' };

  // A known key with nothing after the colon says nothing: `level:` is a
  // question abandoned mid-sentence, not prose and not a filter.
  if (raw === '') return { kind: 'drop' };

  const parsed = CODECS[variant].parse(raw);
  return parsed.kind === 'filter' ? { ...parsed, id } : parsed;
}

/**
 * Reads a query string into filters and free text.
 */
export function parseFilterQuery(
  input: string,
  variants: FilterVariants,
): { filters: ColumnFiltersState; search: string } {
  const filters: ColumnFiltersState = [];
  const text: string[] = [];

  for (const token of tokenize(input)) {
    const parsed = parseToken(token, variants);

    if (parsed.kind === 'text') text.push(token);
    else if (parsed.kind === 'filter') {
      filters.push({ id: parsed.id, value: parsed.value });
    }
  }

  return { filters: mergeFilters(filters), search: text.join(' ') };
}

/** The same key twice merges rather than duplicating: `level:a level:b`. */
function mergeFilters(filters: ColumnFiltersState): ColumnFiltersState {
  const merged: ColumnFiltersState = [];
  for (const filter of filters) {
    const existing = merged.find((f) => f.id === filter.id);
    if (
      existing &&
      Array.isArray(existing.value) &&
      Array.isArray(filter.value)
    ) {
      existing.value = [...new Set([...existing.value, ...filter.value])];
    } else if (!existing) {
      merged.push({ ...filter });
    } else {
      existing.value = filter.value;
    }
  }
  return merged;
}

/** Writes filters and free text back into the one string `parse` reads. */
export function formatFilterQuery(
  filters: ColumnFiltersState,
  search: string,
  variants: FilterVariants,
): string {
  const tokens: string[] = [];

  for (const { id, value } of filters) {
    const variant = variants[id];
    const formatted = variant ? CODECS[variant].format(value) : null;
    if (formatted !== null) tokens.push(`${id}:${formatted}`);
  }

  if (search) tokens.push(quoted(search));

  return tokens.join(' ');
}

/* --- The URL ------------------------------------------------------------- */

/*
 * Four parameters, every one omitted at its default so a fresh table is a
 * clean address: `?q=level:error&sort=-events&page=3&per=25`. The page is
 * 1-based in the URL and 0-based in state, because an address is read by
 * people and an index is read by an array.
 */

export function parseTableQuery(
  params: URLSearchParams,
  variants: FilterVariants,
  pageSize: number = DEFAULT_PAGE_SIZE,
): DataTableQuery {
  const query = emptyTableQuery(pageSize);

  const q = params.get('q');
  if (q) {
    const parsed = parseFilterQuery(q, variants);
    query.filters = parsed.filters;
    query.search = parsed.search;
  }

  const sort = params.get('sort');
  if (sort) {
    query.sorting = sort
      .split(',')
      .filter(Boolean)
      .map((part) =>
        part.startsWith('-')
          ? { id: part.slice(1), desc: true }
          : { id: part, desc: false },
      );
  }

  const page = Number(params.get('page'));
  if (Number.isInteger(page) && page > 1) {
    query.pagination.pageIndex = page - 1;
  }

  const per = Number(params.get('per'));
  if (Number.isInteger(per) && per > 0) {
    query.pagination.pageSize = per;
  }

  return query;
}

export function serializeTableQuery(
  query: DataTableQuery,
  variants: FilterVariants,
  pageSize: number = DEFAULT_PAGE_SIZE,
): URLSearchParams {
  const params = new URLSearchParams();

  const q = formatFilterQuery(query.filters, query.search, variants);
  if (q) params.set('q', q);

  if (query.sorting.length) {
    params.set(
      'sort',
      query.sorting.map((s) => (s.desc ? `-${s.id}` : s.id)).join(','),
    );
  }

  if (query.pagination.pageIndex > 0) {
    params.set('page', String(query.pagination.pageIndex + 1));
  }
  if (query.pagination.pageSize !== pageSize) {
    params.set('per', String(query.pagination.pageSize));
  }

  return params;
}
