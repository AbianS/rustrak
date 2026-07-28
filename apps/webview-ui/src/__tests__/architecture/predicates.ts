/**
 * Shared predicates for the architecture suite.
 *
 * **This file used to walk the filesystem.** It exported `directoriesUnder`,
 * `sourceFilesUnder`, `containsRoute` and friends, because the first version of
 * the suite selected and counted files by hand and only used archunit for the
 * assertion. It does not any more: selection, counting and assertion all go
 * through `projectFiles()`, so what is left here is two pure string functions
 * that archunit's `adhereTo` calls on the `FileInfo` it hands over.
 *
 * That matters beyond tidiness. A hand-rolled walk and archunit's own file
 * discovery are two different answers to "which files are in this project", and
 * a rule whose population came from one and whose verdict came from the other
 * could disagree with itself silently.
 */

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
 * that line. That can only hide a violation sharing a line with a URL, which no
 * rule here has met, and it never invents one.
 */
export function withoutComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, ' ');

  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/\/\/[^\n]*/g, blank);
}
