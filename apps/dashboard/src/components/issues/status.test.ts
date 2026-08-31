import { emptyTableQuery } from '@rustrak/ui';
import { describe, expect, it } from 'vitest';
import { narrows, withDefaultStatus, withoutDefaultStatus } from './status';

const query = (filters: { id: string; value: unknown }[], search = '') => ({
  ...emptyTableQuery(25),
  filters,
  search,
});

describe('withDefaultStatus', () => {
  it('puts the chip on a query that carries no status', () => {
    expect(withDefaultStatus(query([])).filters).toEqual([
      { id: 'is', value: ['open'] },
    ]);
  });

  it('leaves a status the URL already carried alone', () => {
    const carried = query([{ id: 'is', value: ['resolved'] }]);

    expect(withDefaultStatus(carried).filters).toEqual(carried.filters);
  });
});

describe('withoutDefaultStatus', () => {
  it('drops the default on the way out, so a plain list has an empty query', () => {
    expect(
      withoutDefaultStatus(query([{ id: 'is', value: ['open'] }])).filters,
    ).toEqual([]);
  });

  it('keeps any other status, which is a place worth sharing', () => {
    const all = query([{ id: 'is', value: ['all'] }]);

    expect(withoutDefaultStatus(all).filters).toEqual(all.filters);
  });
});

describe('narrows', () => {
  it('is false for the list nobody has touched', () => {
    expect(narrows(query([{ id: 'is', value: ['open'] }]))).toBe(false);
  });

  it('is false for `is:all`, which is how you say you do not care', () => {
    // An empty project read in `all` holds nothing; no filter turned anything
    // away, so it gets the onboarding empty state rather than "nothing
    // matches".
    expect(narrows(query([{ id: 'is', value: ['all'] }]))).toBe(false);
  });

  it('is true for a status that leaves issues out', () => {
    expect(narrows(query([{ id: 'is', value: ['resolved'] }]))).toBe(true);
    expect(narrows(query([{ id: 'is', value: ['muted'] }]))).toBe(true);
  });

  it('is true when anything else is filtered, `is:all` included', () => {
    expect(
      narrows(
        query([
          { id: 'is', value: ['all'] },
          { id: 'level', value: ['error'] },
        ]),
      ),
    ).toBe(true);
  });

  it('is true when something was typed', () => {
    expect(narrows(query([{ id: 'is', value: ['all'] }], 'timeout'))).toBe(
      true,
    );
  });
});
