import type { RowData } from '@tanstack/react-table';
import type { DataTableColumnDef, FilterOption } from '../data-table/features';
import type { FilterVariants } from '../data-table/query';
import type { IconComponent } from '../icon/icon';

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
    /*
     * `column.id` is only set when the definition names it explicitly: the
     * table derives an id from `accessorKey` itself, but only once these
     * definitions reach `useTable` -- reading them here, first, sees none of
     * that. Redo the same derivation TanStack does, so an accessor-only
     * filterable column is not silently dropped from the bar.
     */
    const accessorKey =
      'accessorKey' in column ? column.accessorKey : undefined;
    const id =
      column.id ??
      (typeof accessorKey === 'string'
        ? accessorKey.replaceAll('.', '_')
        : undefined);
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

/**
 * What the bar is currently being asked, read off the draft alone.
 *
 * The bar has three phases and they are not exclusive to one another's
 * syntax: no field yet (completing a field name), a field picked from the
 * list (`pickedKey`, which never appears in the input), and a field typed as
 * a `key:` token. This resolves all three into one answer so the hook and the
 * suggestion list cannot disagree about which one is running.
 */
export interface QueryPhase {
  /** The field named by a `key:` token under the caret, if any. */
  typedField: QueryField | undefined;
  /** The field taken from the list, whose values the popup is offering. */
  pickedField: QueryField | undefined;
  /** Whichever of the two is in force; a pick wins over a typed token. */
  activeField: QueryField | undefined;
  /** What is being typed as a value, once a field is in force. */
  valueFragment: string;
  /** What is being typed as a field name, while none is in force. */
  fieldNeedle: string;
  /** The part of the draft a completion keeps, verbatim. */
  prefix: string;
}

export function detectPhase(
  draft: string,
  fields: QueryField[],
  pickedKey: string | null,
): QueryPhase {
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
   * Level, and taking it keeps `timeout` -- the fragment is replaced, never
   * appended to.
   */
  const fragmentMatch = draft.match(/(^|\s)(\S*)$/);
  const fragment = fragmentMatch?.[2] ?? '';
  const fragmentPrefix = draft.slice(
    0,
    (fragmentMatch?.index ?? 0) + (fragmentMatch?.[1]?.length ?? 0),
  );

  // With a picked field, whatever is being typed narrows its values. With a
  // typed one, the value is the text after its colon.
  const valueFragment = pickedField
    ? fragment
    : typedField
      ? (tokenMatch?.[3] ?? '')
      : '';

  // A typed token is replaced whole, `key:` included; anything else replaces
  // only the fragment.
  const prefix =
    !pickedField && typedField
      ? draft.slice(
          0,
          (tokenMatch?.index ?? 0) + (tokenMatch?.[1]?.length ?? 0),
        )
      : fragmentPrefix;

  return {
    typedField,
    pickedField,
    activeField,
    valueFragment,
    fieldNeedle: activeField ? '' : fragment.toLowerCase(),
    prefix,
  };
}
