import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

/*
 * Stories and tests are excluded. A story is a fixture and this file is *about*
 * the mistake -- both are full of the strings being searched for, and neither
 * ships. What has to be clean is the code that does.
 */
const files = sourceFiles(srcDir)
  .filter((path) => !/\.(?:test\.ts|stories\.tsx)$/.test(path))
  .map((path) => ({
    path: path.slice(srcDir.length),
    // The prose in `motion.ts` explains the mistake at length, so the comments
    // come out before the file is searched for it.
    code: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''),
  }));

/*
 * Tailwind 4 never emits `transform`.
 *
 * `scale-97`, `translate-x-*` and `rotate-180` compile to the individual
 * `scale`, `translate` and `rotate` properties. A `transition-[transform]` is
 * therefore a transition on a property that never changes: the value still
 * jumps to its new state, it just jumps instantly. Nothing throws, nothing
 * looks wrong in a screenshot, and every animation in the package is dead.
 *
 * It happened once. This is the guard so it cannot happen quietly again.
 */
describe('transitions name properties Tailwind actually writes', () => {
  it('never transitions `transform`', () => {
    const offenders = files.filter(
      ({ code }) =>
        /transition-\[[^\]]*transform/.test(code) ||
        /transition-transform/.test(code),
    );

    expect(offenders.map(({ path }) => path)).toEqual([]);
  });

  it('transitions `scale` wherever something scales', () => {
    const offenders = files.filter(({ code }) => {
      if (!/(?:^|[:\s'"`])-?scale-\d/.test(code)) return false;
      // The element that scales may inherit its transition from a shared
      // constant, so either naming `scale` or importing one of those counts.
      return !(
        /transition-\[[^\]]*scale/.test(code) ||
        /interactiveTransition|popTransition|pressScale|chevronFlip/.test(code)
      );
    });

    expect(offenders.map(({ path }) => path)).toEqual([]);
  });

  it('transitions `translate` wherever something translates', () => {
    const offenders = files.filter(({ code }) => {
      if (!/(?:^|[:\s'"`])-?translate-[xy]-/.test(code)) return false;
      return !(
        /transition-\[[^\]]*translate/.test(code) ||
        /interactiveTransition|popTransition|slideTransition/.test(code)
      );
    });

    expect(offenders.map(({ path }) => path)).toEqual([]);
  });
});
