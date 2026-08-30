import { describe, expect, it } from 'vitest';
import type { DataTableColumnDef } from '../data-table/features';
import {
  detectPhase,
  type QueryField,
  queryFieldsFromColumns,
  variantsFromFields,
} from './query-bar-parts';

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

describe('detectPhase', () => {
  const fields: QueryField[] = [
    { key: 'level', label: 'Level', variant: 'options' },
    { key: 'events', label: 'Events', variant: 'range' },
  ];

  it('completes a field name while nothing is in force', () => {
    const phase = detectPhase('lev', fields, null);

    expect(phase.activeField).toBeUndefined();
    expect(phase.fieldNeedle).toBe('lev');
    expect(phase.prefix).toBe('');
  });

  it('keeps what was already typed before the fragment', () => {
    const phase = detectPhase('timeout lev', fields, null);

    expect(phase.fieldNeedle).toBe('lev');
    expect(phase.prefix).toBe('timeout ');
  });

  it('reads a typed key: token as the field in force', () => {
    const phase = detectPhase('level:err', fields, null);

    expect(phase.typedField?.key).toBe('level');
    expect(phase.activeField?.key).toBe('level');
    expect(phase.valueFragment).toBe('err');
    // The whole token is replaced, `key:` included.
    expect(phase.prefix).toBe('');
  });

  it('lets a picked field win over a typed token', () => {
    const phase = detectPhase('level:err', fields, 'events');

    expect(phase.pickedField?.key).toBe('events');
    expect(phase.activeField?.key).toBe('events');
    // A pick replaces only the fragment, so the token stays prose.
    expect(phase.valueFragment).toBe('level:err');
  });

  it('offers no field name once a field is in force', () => {
    expect(detectPhase('level:err', fields, null).fieldNeedle).toBe('');
  });

  it('ignores a key: token for a field the table does not have', () => {
    const phase = detectPhase('nope:x', fields, null);

    expect(phase.typedField).toBeUndefined();
    expect(phase.fieldNeedle).toBe('nope:x');
  });

  it('treats an unknown picked key as no pick at all', () => {
    expect(detectPhase('x', fields, 'gone').pickedField).toBeUndefined();
  });
});
