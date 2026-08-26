import {
  type DataTableQuery,
  type FilterVariants,
  parseTableQuery,
  serializeTableQuery,
} from '@rustrak/ui';

/**
 * A table's place, as it sits in the URL and as the server takes it.
 *
 * The four names are `@rustrak/ui`'s and Rust's `ListQuery` reads the same
 * four, so the address bar, the loader's request and the server's parser are
 * one shape rather than three translations of one.
 */
export interface TableSearch {
  q?: string;
  sort?: string;
  page?: number;
  per?: number;
}

function positiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** For a route's `validateSearch`. Anything unrecognised is dropped. */
export function validateTableSearch(
  search: Record<string, unknown>,
): TableSearch {
  const validated: TableSearch = {};

  const q = text(search.q);
  if (q) validated.q = q;

  const sort = text(search.sort);
  if (sort) validated.sort = sort;

  const page = positiveInt(search.page);
  if (page && page > 1) validated.page = page;

  const per = positiveInt(search.per);
  if (per) validated.per = per;

  return validated;
}

function toParams(search: TableSearch): URLSearchParams {
  const params = new URLSearchParams();
  if (search.q) params.set('q', search.q);
  if (search.sort) params.set('sort', search.sort);
  if (search.page) params.set('page', String(search.page));
  if (search.per) params.set('per', String(search.per));
  return params;
}

export function toTableQuery(
  search: TableSearch,
  variants: FilterVariants,
  pageSize: number,
): DataTableQuery {
  return parseTableQuery(toParams(search), variants, pageSize);
}

export function fromTableQuery(
  query: DataTableQuery,
  variants: FilterVariants,
  pageSize: number,
): TableSearch {
  const params = serializeTableQuery(query, variants, pageSize);
  return validateTableSearch(Object.fromEntries(params));
}
