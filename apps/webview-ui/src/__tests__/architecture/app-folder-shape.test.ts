import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';
import { isTestFile } from './predicates';

/**
 * AD-9 rule (8): everything under `app/` is either a file Next itself gives
 * meaning to, or a component sitting in a `_components/` folder.
 *
 * **This replaces a rule that checked the wrong thing.** The previous version
 * walked *directories* and asked whether each one contributed a route, which
 * caught a folder named `components/` pretending to be a route segment but was
 * blind to the actual constraint: sixteen components sat loose beside their
 * `page.tsx`, in folders that did contribute routes, and the rule passed. The
 * spec's requirement is about files, so the rule is about files now.
 *
 * The directory check is not lost, it is subsumed. A folder that contributes no
 * route can only hold files, and those files are not in a `_components/` folder
 * -- so the file rule reports them, and names the file rather than the folder,
 * which is the thing someone has to move.
 *
 * **Unconditional, with no size threshold.** One component beside a page is as
 * much a violation as eleven. A threshold is a judgement call, judgement calls
 * rot, and the six-component threshold this replaces is what let the sixteen
 * accumulate.
 */

/**
 * The files Next resolves by name. Everything here is a framework contract:
 * renaming `page.tsx` unroutes the page, so these cannot move into
 * `_components/` and are not violations.
 *
 * Metadata routes (`icon`, `opengraph-image`, ...) are included because Next
 * resolves them the same way, even though none exists here yet. Listing them
 * now costs nothing and stops the rule from firing on the first one added.
 */
const NEXT_SPECIAL = new Set([
  'page',
  'layout',
  'loading',
  'error',
  'global-error',
  'not-found',
  'forbidden',
  'unauthorized',
  'template',
  'default',
  'route',
  'sitemap',
  'robots',
  'manifest',
  'icon',
  'apple-icon',
  'opengraph-image',
  'twitter-image',
]);

const posix = (path: string) => path.split('\\').join('/');

/** `app/(main)/projects/[id]/page.tsx` -> `page`. */
const stem = (path: string) =>
  posix(path)
    .split('/')
    .pop()
    ?.replace(/\.tsx?$/, '') ?? '';

describe('AD-9 rule (8): the shape of app/', () => {
  /**
   * The population, asserted as a number rather than delegated to archunit.
   *
   * archunit raises `EmptyTestViolation` when a filter matches nothing, which
   * covers the total-glob-failure case. It does not report how many files it
   * did match, so a glob that silently narrowed to a handful would still pass
   * every negative below. AD-9 asks for a specific committed number, so this
   * counts them.
   */
  it('reads the population it expects to read', async () => {
    const underApp = await projectFiles()
      .inFolder('src/app/**')
      .shouldNot()
      .adhereTo(() => true, 'counted')
      .check();

    // 49 source files under `app/`. It was 53 until the page tests were
    // deleted, and this floor is what reported that rather than absorbing it:
    // the four `__tests__` folders under `app/` went with them.
    expect(underApp.length).toBeGreaterThanOrEqual(49);
  });

  it('has no component sitting loose beside a route', async () => {
    const rule = projectFiles()
      .inFolder('src/app/**')
      .shouldNot()
      .adhereTo(
        (file) =>
          !isTestFile(file.path) &&
          !NEXT_SPECIAL.has(stem(file.path)) &&
          !posix(file.path).includes('/_components/'),
        'sits loose under app/: move it to a _components/ folder, or to the feature whose type it renders',
      );

    await expect(rule).toPassAsync();
  });

  /**
   * A `_`-prefixed folder directly under `app/` has no route group to sit
   * inside, so it competes with the root route rather than hiding beneath it.
   */
  it('has no private folder at the bare app/ root', async () => {
    const rule = projectFiles()
      .inFolder('src/app/**')
      .shouldNot()
      .adhereTo(
        (file) => /(^|\/)app\/_[^/]+\//.test(posix(file.path)),
        'sits in a private folder at the bare app/ root, where it competes with the root route',
      );

    await expect(rule).toPassAsync();
  });
});
