import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Shared walking for the architecture suite.
 *
 * `node:fs` rather than a glob library, deliberately. AD-9 warns that
 * `archunit`'s `FileInfo.name` strips only the last extension, so a predicate
 * written against `.test.ts` never matches and the rule passes vacuously
 * forever. Anything this suite can answer by reading the tree directly, it
 * answers directly, and every rule states the population it expected to find.
 */

export const SRC = resolve(__dirname, '../..');
export const APP = join(SRC, 'app');

const IGNORED_DIRS = new Set(['node_modules', '.next', 'dist']);

/** Every directory under `root`, depth-first, as absolute paths. */
export function directoriesUnder(root: string): string[] {
  const out: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || IGNORED_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      out.push(full);
      walk(full);
    }
  };

  walk(root);
  return out;
}

/** Every `.ts`/`.tsx` file under `root`, as absolute paths. */
export function sourceFilesUnder(root: string): string[] {
  const out: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };

  walk(root);
  return out;
}

/**
 * Whether a path is test code, which every rule here exempts.
 *
 * Tests legitimately do what the rules forbid: they mint `{success: false}` to
 * stand in for a client response, and they contain the strings the content
 * rules look for.
 *
 * **Matched on `path`, never on `name`.** AD-9 warns about this and it is real:
 * archunit's `FileInfo` splits `auth.test.ts` into `name: 'auth.test'` and
 * `extension: 'ts'`, so the obvious `name.endsWith('.test.ts')` is false for
 * every file that has ever existed, and a rule written that way excludes
 * nothing while looking like it excludes everything.
 */
export function isTestFile(path: string): boolean {
  const normalised = path.split('\\').join('/');
  return (
    normalised.includes('/__tests__/') ||
    /\.(test|spec)\.tsx?$/.test(normalised)
  );
}

/** Path relative to `src/`, with forward slashes, for readable failures. */
export function rel(path: string): string {
  return relative(SRC, path).split('\\').join('/');
}

export function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * The file with its comments blanked out.
 *
 * Every content-matching rule here needs this, and the reason is not
 * theoretical: rule (7) forbids a `success: false` literal, and the first
 * version of it flagged the doc comment in `actions/auth.ts` that *explains*
 * rule (7). A rule that fires on the prose documenting it is a rule people
 * respond to by deleting the prose.
 *
 * Comments are replaced with equivalent whitespace rather than removed, so any
 * offset a caller computes still lines up with the original source.
 *
 * Known limit: a `//` inside a string literal, as in a URL, blanks the rest of
 * that line. That can only hide a violation sharing a line with a URL, which
 * no rule here has met, and it never invents one.
 */
export function withoutComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');

  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/\/\/[^\n]*/g, blank);
}

/** Whether `dir` contains a routable file anywhere beneath it. */
export function containsRoute(dir: string): boolean {
  const ROUTABLE = new Set(['page.tsx', 'page.ts', 'route.ts', 'route.tsx']);

  const walk = (current: string): boolean => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        if (walk(join(current, entry.name))) return true;
      } else if (ROUTABLE.has(entry.name)) {
        return true;
      }
    }
    return false;
  };

  return statSync(dir).isDirectory() && walk(dir);
}
