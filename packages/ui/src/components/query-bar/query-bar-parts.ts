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
