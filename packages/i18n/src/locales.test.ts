import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale, resolveLocale } from './locales';

describe('which language to answer in', () => {
  it('takes the stored preference over anything the browser says', () => {
    expect(
      resolveLocale({ stored: 'fr', acceptLanguage: 'es-ES,es;q=0.9' }),
    ).toBe('fr');
  });

  it('ignores a stored preference for a language with no catalog', () => {
    expect(resolveLocale({ stored: 'de', acceptLanguage: 'fr' })).toBe('fr');
  });

  it('reads a region tag as its base language', () => {
    expect(resolveLocale({ stored: 'zh-Hans-CN' })).toBe('zh');
    expect(resolveLocale({ acceptLanguage: 'fr-CA' })).toBe('fr');
  });

  it('honours q-values rather than header order', () => {
    expect(resolveLocale({ acceptLanguage: 'de;q=0.9,ro;q=1.0' })).toBe('ro');
  });

  it('skips a language the reader explicitly refused', () => {
    // `q=0` means "not this one", which is the opposite of no preference.
    expect(resolveLocale({ acceptLanguage: 'fr;q=0,es;q=0.5' })).toBe('es');
  });

  it('falls back to English', () => {
    expect(resolveLocale()).toBe(DEFAULT_LOCALE);
    expect(resolveLocale({ acceptLanguage: 'de,ja;q=0.8' })).toBe('en');
    expect(resolveLocale({ stored: null, acceptLanguage: '' })).toBe('en');
  });

  it('reads navigator.languages before the header', () => {
    expect(resolveLocale({ preferred: ['ro'], acceptLanguage: 'es' })).toBe(
      'ro',
    );
  });

  it('survives a malformed header instead of throwing', () => {
    expect(resolveLocale({ acceptLanguage: ',,;q=,fr' })).toBe('fr');
  });
});

describe('isLocale', () => {
  it('accepts the languages there are catalogs for', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ro')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isLocale('de')).toBe(false);
    expect(isLocale('EN')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});
