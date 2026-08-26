import { active, translate } from '@rustrak/i18n';

export interface UiLabels {
  /* Dialog */
  close: string;
  confirm: string;
  cancel: string;
  /** `{phrase}` is the word that must be typed. */
  confirmPhrase: string;
  /** `{count}` characters still missing. */
  confirmCharactersLeft: string;
  escapeCancels: string;

  /* Table */
  selectAllRows: string;
  selectRow: string;
  rowActions: string;
  actionsColumn: string;
  /** `{count}` rows ticked. */
  rowsSelected: string;
  selectionActions: string;
  clearSelection: string;
  clearFilters: string;
  previousPage: string;
  nextPage: string;
  rowsPerPage: string;
  chooseColumns: string;
  columns: string;
  clearFilter: string;
  hideColumn: string;
  filterValues: string;
  filterValuesPlaceholder: string;
  nothingMatches: string;
  rangeMin: string;
  rangeMax: string;

  /* Query bar */
  queryBarPlaceholder: string;
  queryBarLabel: string;
  queryBarClear: string;
  queryBarSuggestions: string;
  queryBarFilterBy: string;
  queryBarTypeValue: string;
  /** The placeholder once at least one chip is in the bar. */
  queryBarAddFilter: string;
  /** `{field}` is the filter being taken off. */
  queryBarRemoveFilter: string;

  /* Shell */
  mainNavigation: string;
  topbarSearch: string;
  /** A verb, not a sentence: the row is 216 px less an icon and a shortcut. */
  expandSidebar: string;
  collapseSidebar: string;
  openNavigation: string;
  closeNavigation: string;

  /* Pagination */
  /** `{first}`, `{last}` and `{total}`, already formatted. */
  pageRange: string;
  /** `{count}` rows a page holds. */
  rowsPerPageValue: string;
  /** One choice in the page-size menu. */
  rowsOption: string;

  /* Query bar hints */
  hintNavigate: string;
  hintSelect: string;
  hintClose: string;

  /* Other */
  loading: string;
  breadcrumb: string;
  dismiss: string;
  waterfallEmptyTitle: string;
  waterfallEmptyDescription: string;
  waterfallResize: string;
}

export const DEFAULT_UI_LABELS: UiLabels = {
  close: 'Close',
  confirm: 'Confirm',
  cancel: 'Cancel',
  confirmPhrase: 'Type {phrase} to continue',
  confirmCharactersLeft: '{count} characters left',
  escapeCancels: 'Esc cancels',

  selectAllRows: 'Select all rows on this page',
  selectRow: 'Select row',
  rowActions: 'Row actions',
  actionsColumn: 'Actions',
  rowsSelected: '{count} selected',
  selectionActions: 'Actions for the selected rows',
  clearSelection: 'Clear',
  clearFilters: 'Clear filters',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  rowsPerPage: 'Rows',
  chooseColumns: 'Choose columns',
  columns: 'Columns',
  clearFilter: 'Clear filter',
  hideColumn: 'Hide column',
  filterValues: 'Filter values',
  filterValuesPlaceholder: 'Filter values…',
  nothingMatches: 'Nothing matches',
  rangeMin: 'Min',
  rangeMax: 'Max',

  queryBarPlaceholder: 'Filter by key:value, or search…',
  queryBarLabel: 'Filter and search',
  queryBarClear: 'Clear filters and search',
  queryBarSuggestions: 'Suggestions',
  queryBarFilterBy: 'Filter by',
  queryBarTypeValue: 'Type a value, then',
  queryBarAddFilter: 'Add a filter…',
  queryBarRemoveFilter: 'Remove the {field} filter',

  mainNavigation: 'Main navigation',
  topbarSearch: 'Search Rustrak…',
  expandSidebar: 'Expand',
  collapseSidebar: 'Collapse',
  openNavigation: 'Open navigation',
  closeNavigation: 'Close navigation',

  pageRange: '{first}–{last} of {total}',
  rowsPerPageValue: 'Rows {count}',
  rowsOption: '{count} rows',

  hintNavigate: 'navigate',
  hintSelect: 'select',
  hintClose: 'closes',

  loading: 'Loading',
  breadcrumb: 'Breadcrumb',
  dismiss: 'Dismiss',
  waterfallEmptyTitle: 'No spans',
  waterfallEmptyDescription: 'This trace carries no timing to draw.',
  waterfallResize: 'Resize the name column',
};

/** `fill('{count} selected', { count: 3 })`. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

/**
 * What the system says, in whatever language is active.
 *
 * A plain function, not a hook and not a prop. `@rustrak/i18n` holds the
 * active translator as a module singleton -- the shape `@lingui/core` itself
 * uses -- so a component asks for its own copy without being handed anything.
 * No provider to wrap the tree in, nothing that rules out a server component,
 * and it works the same in a framework that is not React.
 *
 * With nothing activated it answers the English default, which is what keeps
 * Storybook and a single-locale consumer working untouched.
 */
export function uiLabel(
  name: keyof UiLabels,
  values?: Record<string, string | number>,
): string {
  const translated = translate(`ui.${name}` as `ui.${keyof UiLabels}`, values);
  if (translated !== undefined) return translated;

  const fallback = DEFAULT_UI_LABELS[name];
  return values ? fill(fallback, values) : fallback;
}

/**
 * The locale the system formats its own figures with.
 *
 * `1,234` is `1.234` in Spanish, and a footer reading `1–50 of 12,403` on a
 * Spanish page is a number nobody there writes.
 */
export function uiLocale(): string | undefined {
  return active()?.locale;
}
