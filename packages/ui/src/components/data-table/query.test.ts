import { describe, expect, it } from 'vitest';
import {
  emptyTableQuery,
  type FilterVariants,
  formatFilterQuery,
  parseFilterQuery,
  parseTableQuery,
  serializeTableQuery,
} from './query';

const variants: FilterVariants = {
  level: 'options',
  release: 'text',
  events: 'range',
};

describe('parseFilterQuery', () => {
  it('reads options, text and range tokens into their value shapes', () => {
    const { filters, search } = parseFilterQuery(
      'level:error,fatal release:2.1.0 events:100..500',
      variants,
    );

    expect(filters).toEqual([
      { id: 'level', value: ['error', 'fatal'] },
      { id: 'release', value: '2.1.0' },
      { id: 'events', value: [100, 500] },
    ]);
    expect(search).toBe('');
  });

  it('keeps what no key claims as free text, in order', () => {
    const { filters, search } = parseFilterQuery(
      'timeout level:error checkout',
      variants,
    );

    expect(filters).toEqual([{ id: 'level', value: ['error'] }]);
    expect(search).toBe('timeout checkout');
  });

  it('treats an unknown key as prose, not as a phantom filter', () => {
    const { filters, search } = parseFilterQuery('error: undefined', variants);

    expect(filters).toEqual([]);
    expect(search).toBe('error: undefined');
  });

  it('drops a known key with nothing after the colon', () => {
    const { filters, search } = parseFilterQuery('level: timeout', variants);

    expect(filters).toEqual([]);
    expect(search).toBe('timeout');
  });

  it('respects quotes in text values and in free text', () => {
    const { filters, search } = parseFilterQuery(
      'release:"not deployed" "connection reset"',
      variants,
    );

    expect(filters).toEqual([{ id: 'release', value: 'not deployed' }]);
    expect(search).toBe('connection reset');
  });

  it('reads an escaped quote inside a quoted text value literally', () => {
    const { filters } = parseFilterQuery(
      'release:"say \\"hi\\" now"',
      variants,
    );

    expect(filters).toEqual([{ id: 'release', value: 'say "hi" now' }]);
  });

  it('merges a key written twice instead of duplicating it', () => {
    const { filters } = parseFilterQuery('level:error level:fatal', variants);

    expect(filters).toEqual([{ id: 'level', value: ['error', 'fatal'] }]);
  });

  it('supports open-ended ranges on either side', () => {
    expect(parseFilterQuery('events:100..', variants).filters).toEqual([
      { id: 'events', value: [100, null] },
    ]);
    expect(parseFilterQuery('events:..500', variants).filters).toEqual([
      { id: 'events', value: [null, 500] },
    ]);
    // Both ends open filters nothing: the token stays text.
    expect(parseFilterQuery('events:..', variants).filters).toEqual([]);
  });
});

describe('formatFilterQuery', () => {
  it('round-trips through parse', () => {
    const input = 'level:error,fatal release:2.1.0 events:100..500 timeout';
    const { filters, search } = parseFilterQuery(input, variants);

    expect(formatFilterQuery(filters, search, variants)).toBe(input);
  });

  it('quotes a text value with spaces', () => {
    expect(
      formatFilterQuery(
        [{ id: 'release', value: 'not deployed' }],
        '',
        variants,
      ),
    ).toBe('release:"not deployed"');
  });

  it('escapes an embedded quote so it round-trips through parse', () => {
    const formatted = formatFilterQuery(
      [{ id: 'release', value: 'say "hi" now' }],
      '',
      variants,
    );

    expect(formatted).toBe('release:"say \\"hi\\" now"');
    expect(parseFilterQuery(formatted, variants).filters).toEqual([
      { id: 'release', value: 'say "hi" now' },
    ]);
  });

  it('drops empty filters instead of writing empty tokens', () => {
    expect(
      formatFilterQuery(
        [
          { id: 'level', value: [] },
          { id: 'events', value: [null, null] },
          { id: 'release', value: '' },
        ],
        '',
        variants,
      ),
    ).toBe('');
  });
});

describe('URL round-trip', () => {
  it('serializes only what is not at its default', () => {
    const params = serializeTableQuery(emptyTableQuery(), variants);

    expect(params.toString()).toBe('');
  });

  it('round-trips a full query', () => {
    const query = {
      sorting: [{ id: 'events', desc: true }],
      filters: [{ id: 'level', value: ['error'] }],
      search: 'timeout',
      pagination: { pageIndex: 2, pageSize: 25 },
    };

    const params = serializeTableQuery(query, variants);
    expect(params.get('q')).toBe('level:error timeout');
    expect(params.get('sort')).toBe('-events');
    expect(params.get('page')).toBe('3');
    expect(params.get('per')).toBe('25');

    expect(parseTableQuery(params, variants)).toEqual(query);
  });

  it('survives a mangled address by degrading to defaults', () => {
    const params = new URLSearchParams('page=-4&per=abc&sort=');
    const query = parseTableQuery(params, variants);

    expect(query).toEqual(emptyTableQuery());
  });
});
