import { describe, expect, it } from 'vitest';
import type { DataTableColumnDef } from '../data-table/features';
import { queryFieldsFromColumns, variantsFromFields } from './query-bar-parts';

interface Issue {
  title: string;
  release: string;
  'nested.key': string;
}

describe('queryFieldsFromColumns', () => {
  it('reads a filterable column that names its id explicitly', () => {
    const columns: DataTableColumnDef<Issue>[] = [
      { id: 'title', header: 'Title', meta: { filter: { variant: 'text' } } },
    ];

    expect(queryFieldsFromColumns(columns)).toEqual([
      { key: 'title', label: 'Title', icon: undefined, variant: 'text' },
    ]);
  });

  it('falls back to accessorKey when a column has no explicit id', () => {
    const columns: DataTableColumnDef<Issue>[] = [
      {
        accessorKey: 'release',
        header: 'Release',
        meta: { filter: { variant: 'text' } },
      },
    ];

    expect(queryFieldsFromColumns(columns)).toEqual([
      { key: 'release', label: 'Release', icon: undefined, variant: 'text' },
    ]);
  });

  it('replaces dots in a nested accessorKey the way the table does', () => {
    const columns: DataTableColumnDef<Issue>[] = [
      {
        accessorKey: 'nested.key',
        header: 'Nested',
        meta: { filter: { variant: 'text' } },
      },
    ];

    expect(queryFieldsFromColumns(columns)[0]?.key).toBe('nested_key');
  });
});

describe('variantsFromFields', () => {
  it('maps each field key to its variant', () => {
    const fields = queryFieldsFromColumns<Issue>([
      { id: 'title', meta: { filter: { variant: 'text' } } },
      { accessorKey: 'release', meta: { filter: { variant: 'options' } } },
    ]);

    expect(variantsFromFields(fields)).toEqual({
      title: 'text',
      release: 'options',
    });
  });
});
