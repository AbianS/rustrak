import { basename, dirname } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP, containsRoute, directoriesUnder, rel } from './source-files';

/**
 * AD-9 rule (8): every folder under `app/` is a route segment, a route group
 * `(name)`, a parallel slot `@name`, or a private `_`-prefixed folder — and no
 * `_` folder sits at the bare `app/` root.
 *
 * The naive version of this rule, matching folder names against a pattern,
 * cannot work: `components` is a perfectly legal segment name, so the live
 * violation at `app/(main)/settings/team/components/` would pass. What makes it
 * a violation is that it contributes no route while pretending to be one.
 *
 * So the predicate is about reachability, not spelling: a folder that is not a
 * group, a slot or `_`-prefixed must have a routable file **somewhere beneath
 * it**. That distinction is load-bearing in the other direction too —
 * `issues/[issueId]/events/` holds no `page.tsx` of its own and is entirely
 * legal, because its children do.
 */

const ROUTE_GROUP = /^\(.+\)$/;
const PARALLEL_SLOT = /^@/;
const PRIVATE = /^_/;

const directories = directoriesUnder(APP);

describe('AD-9 rule (8): the shape of app/', () => {
  // The floor is a committed number, never `> 0`. A glob or a walk that
  // silently matches one directory out of forty passes a `> 0` assertion while
  // proving nothing, which is the vacuous-rule failure AD-9 exists to prevent.
  it('walks the population it expects to walk', () => {
    // 38 after phase 6, excluding `app/` itself. It was 39 before: the domain
    // components left, and `settings/team/_components` went with them.
    expect(directories.length).toBeGreaterThanOrEqual(38);
  });

  it('has no folder that contributes no route and is not marked private', () => {
    const violations = directories
      .filter((dir) => {
        const name = basename(dir);
        if (ROUTE_GROUP.test(name)) return false;
        if (PARALLEL_SLOT.test(name)) return false;
        if (PRIVATE.test(name)) return false;
        return !containsRoute(dir);
      })
      .map(rel);

    expect(violations).toEqual([]);
  });

  it('has no private folder at the bare app/ root', () => {
    const violations = directories
      .filter((dir) => dirname(dir) === APP && PRIVATE.test(basename(dir)))
      .map(rel);

    // A `_`-prefixed folder directly under `app/` has no route group to sit
    // inside, so it competes with the root route rather than hiding beneath it.
    expect(violations).toEqual([]);
  });
});
