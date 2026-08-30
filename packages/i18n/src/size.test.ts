import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { NAMESPACES } from './generated/catalogs';
import { LOCALES } from './locales';

/**
 * What a page pays for translation, pinned.
 *
 * This is the property the whole design exists for and the one that rots
 * quietly: nothing fails when a page starts loading thirty namespaces instead
 * of four, or when the ICU parser finds its way back into the runtime. It just
 * gets slower, and nobody reads a bundle report until it already is.
 *
 * The test needs `dist`, which is why `@rustrak/i18n#test` depends on its own
 * `build` in `turbo.json`.
 */

const gz = (path: string) => gzipSync(readFileSync(path)).length;

const runtime = () =>
  gz('dist/index.js') + gz('dist/translator.js') + gz('dist/locales.js');

const namespaces = (locale: string, names: readonly string[]) =>
  names.reduce(
    (total, name) => total + gz(`dist/generated/${locale}/${name}.js`),
    0,
  );

describe('what translation costs', () => {
  it('keeps the runtime under 3 kB', () => {
    // Measured at 1.8 kB. `@lingui/core` is small because the ICU parser runs
    // in `scripts/compile-catalogs.mjs` instead of in the browser; a runtime
    // that grows past this has probably taken the parser back.
    expect(runtime()).toBeLessThan(3 * 1024);
  });

  it('costs a page only the namespaces it names', () => {
    const login = ['auth', 'common', 'errors', 'formErrors'];
    const everything = runtime() + namespaces('fr', NAMESPACES);
    const page = runtime() + namespaces('fr', login);

    // The control: without the split this ratio would be 1.
    expect(page).toBeLessThan(everything / 4);
  });

  it('ships one locale, not five', () => {
    const one = namespaces('fr', NAMESPACES);
    const all = LOCALES.reduce(
      (total, locale) => total + namespaces(locale, NAMESPACES),
      0,
    );

    expect(one).toBeLessThan(all / 3);
  });
});
