import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';
import { isTestFile, withoutComments } from './predicates';

/**
 * Translating the chrome is not translating the dashboard.
 *
 * The i18n pass moved every sentence into `messages/*.json` and stopped there,
 * which left the half of the screen that is *data* still rendered in English:
 * 32 files formatted a date through `date-fns` with no `locale`, a number
 * through a bare `toLocaleString()`, or through an `Intl.NumberFormat('en')`
 * pinned at module scope. A viewer on `/zh` read "3 hours ago" under a Chinese
 * heading.
 *
 * Two of those three are worse than untranslated. `toLocaleString()` with no
 * argument resolves the locale **of whatever process runs it**, so the same
 * value formats one way in the Server Component and another in the browser that
 * hydrates it, and the timezone comes from the deployment rather than the
 * viewer. That is a correctness bug wearing a formatting bug's clothes.
 *
 * next-intl's `useFormatter` / `getFormatter` answer all three: they read the
 * request locale and the configured `timeZone`, they memoise the `Intl`
 * instances the old module-scope cache existed to avoid rebuilding, and the
 * option sets live once in `formats` in the request config instead of at each
 * call site.
 *
 * So the rule is a flat ban rather than an allowlist. There is no module that
 * legitimately needs a locale-blind formatter: every one of these call sites
 * renders to a screen, and every screen has a request behind it.
 *
 * **Why a content predicate and not `dependOnFiles`.** `date-fns` and `Intl`
 * are an external package and a global; neither is a node in the project's
 * import graph, so there is nothing for a graph rule to point at. `adhereTo` is
 * the API the library documents for the remaining case, and `portable-core`
 * already leans on it for the same reason.
 */

const LOCALE_BLIND_FORMAT =
  /toLocale(?:String|DateString|TimeString)\s*\(|new Intl\.|(?:from|import)\s+['"]date-fns['"]/;

/**
 * `Link` and the router, but not `notFound`.
 *
 * With `localePrefix: 'always'` a plain `next/link` href omits the prefix, so
 * the click leaves the app, hits the proxy and comes back as a 307 to the
 * prefixed URL. It works, which is why three of these survived the pass, and it
 * costs a round trip on every navigation that takes the wrong door.
 *
 * `notFound()` is deliberately absent from this list. It raises a control-flow
 * signal rather than producing a URL, next-intl does not wrap it, and four
 * files call it correctly today.
 */
const UNPREFIXED_LINK = /(?:from|import)\s+['"]next\/link['"]/;

const UNPREFIXED_ROUTER =
  /import\s*\{[^}]*\b(?:useRouter|usePathname|redirect|permanentRedirect)\b[^}]*\}\s*from\s+['"]next\/navigation['"]/;

const posix = (path: string) => path.split('\\').join('/');
const isMessages = (path: string) => posix(path).includes('/messages/');

/** Every file a rule here judges: source, not tests, not the dictionaries. */
const judged = (path: string) => !isTestFile(path) && !isMessages(path);

describe('the locale reaches the data, not just the chrome', () => {
  /**
   * The floor.
   *
   * Both assertions below are negatives, and a negative over an empty set is
   * the vacuous pass AD-9 exists to prevent. archunit's own `EmptyTestViolation`
   * cannot catch it: the filter is `src/**`, which always matches, and the
   * narrowing happens inside the predicate where the library cannot see it.
   */
  it('reads the population it expects to read', async () => {
    const source = await projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo((file) => judged(file.path), 'counted');

    // 262 source files after the i18n pass.
    expect((await source.check()).length).toBeGreaterThanOrEqual(250);
  });

  /**
   * The second floor, for the navigation rule specifically.
   *
   * Banning `next/link` means nothing if nobody imports the replacement. This
   * counts the files that go through next-intl's navigation API, so a refactor
   * that deletes the locale-aware `Link` fails here rather than making the ban
   * below trivially satisfiable.
   *
   * Matched on the substring `i18n/navigation` rather than a full alias, so the
   * module can move between `@/i18n` and `@/shared/i18n` without this number
   * silently becoming zero.
   */
  it('sees the locale-aware navigation it requires', async () => {
    const users = await projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo(
        (file) =>
          judged(file.path) &&
          withoutComments(file.content).includes('i18n/navigation'),
        'counted',
      );

    // 48 files after the i18n pass.
    expect((await users.check()).length).toBeGreaterThanOrEqual(45);
  });

  it('formats every date and number through the request locale', async () => {
    const rule = projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo(
        (file) =>
          judged(file.path) &&
          LOCALE_BLIND_FORMAT.test(withoutComments(file.content)),
        "formats a date or a number without the request locale: use next-intl's useFormatter/getFormatter",
      );

    await expect(rule).toPassAsync();
  });

  it('builds every href through the locale-aware navigation API', async () => {
    const rule = projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo((file) => {
        if (!judged(file.path)) return false;
        const source = withoutComments(file.content);
        return UNPREFIXED_LINK.test(source) || UNPREFIXED_ROUTER.test(source);
      }, 'navigates through next/link or next/navigation, which drops the locale prefix and costs a proxy redirect: import from the i18n navigation module');

    await expect(rule).toPassAsync();
  });
});
