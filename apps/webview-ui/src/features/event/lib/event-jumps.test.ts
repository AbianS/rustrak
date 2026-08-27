import { describe, expect, it } from 'vitest';
import { type EventJumpFlags, eventJumpTargets } from './event-jumps';

const nothing: EventJumpFlags = {
  threads: false,
  stackTrace: false,
  breadcrumbs: false,
  contexts: false,
  modules: false,
  user: false,
  tags: false,
};

describe('eventJumpTargets', () => {
  it('always offers highlights: every event has some', () => {
    expect(eventJumpTargets(nothing)).toEqual(['highlights']);
  });

  it('lists sections in the order the page renders them', () => {
    expect(
      eventJumpTargets({
        ...nothing,
        tags: true,
        stackTrace: true,
        breadcrumbs: true,
        user: true,
      }),
    ).toEqual(['highlights', 'stacktrace', 'breadcrumbs', 'tags', 'context']);
  });

  /**
   * Contexts, modules and the user render together under one heading, so they
   * share one anchor: three entries pointing at the same `#context` would read
   * as three places to go and arrive at one.
   */
  it('gives contexts, modules and user a single shared anchor', () => {
    expect(eventJumpTargets({ ...nothing, modules: true })).toEqual([
      'highlights',
      'context',
    ]);
    expect(
      eventJumpTargets({
        ...nothing,
        contexts: true,
        modules: true,
        user: true,
      }),
    ).toEqual(['highlights', 'context']);
  });

  it('omits a section the event has nothing for', () => {
    expect(eventJumpTargets({ ...nothing, tags: true })).toEqual([
      'highlights',
      'tags',
    ]);
  });
});
