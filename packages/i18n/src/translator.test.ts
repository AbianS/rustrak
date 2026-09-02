import { describe, expect, it } from 'vitest';
import {
  activate,
  active,
  createTranslator,
  deactivate,
  emptyTranslator,
  translate,
} from './translator';

describe('formatting the catalogs we actually ship', () => {
  it('interpolates', async () => {
    const t = await createTranslator({ namespaces: ['platforms'] });
    expect(t.t('platforms.matchingCount', { count: 3 })).toBe(
      '3 matching platforms',
    );
  });

  it('keeps an exact plural match distinct from the one category', async () => {
    // French CLDR `one` covers 0 and 1, so an engine that folds `=1` into
    // `one` renders "0 événement". The catalogs say `=1`; this pins it.
    const fr = await createTranslator({ locale: 'fr', namespaces: ['charts'] });

    expect(fr.t('charts.eventCount', { count: 0 })).toBe('0 événements');
    expect(fr.t('charts.eventCount', { count: 1 })).toBe('1 événement');
  });

  it('applies the few category where a language has one', async () => {
    const ro = await createTranslator({ locale: 'ro', namespaces: ['charts'] });

    expect(ro.t('charts.eventCount', { count: 1 })).toBe('1 eveniment');
    expect(ro.t('charts.eventCount', { count: 5 })).toBe('5 evenimente');
    expect(ro.t('charts.eventCount', { count: 20 })).toBe('20 de evenimente');
  });

  it('leaves rich tags in the string for the caller to render', async () => {
    const t = await createTranslator({ namespaces: ['projectPages'] });

    expect(t.t('projectPages.event.inRelease', { release: '1.4.0' })).toBe(
      'in release <rel>1.4.0</rel>',
    );
  });

  it('falls back to the key rather than to nothing', async () => {
    const t = await createTranslator({ namespaces: ['auth'] });

    // @ts-expect-error the point of the type is that this is not a real key
    expect(t.t('auth.nothing.here')).toBe('auth.nothing.here');
  });
});

describe('loading only what a page needs', () => {
  it('does not carry namespaces it was not asked for', async () => {
    const t = await createTranslator({ namespaces: ['auth'] });

    expect(t.has('auth')).toBe(true);
    expect(t.has('issues')).toBe(false);
    // Present in the catalog, absent from this translator, so it degrades to
    // the key exactly as a missing message would.
    expect(t.t('issues.actions.archive')).toBe('issues.actions.archive');
  });

  it('merges several namespaces into one lookup', async () => {
    const t = await createTranslator({ namespaces: ['auth', 'common'] });

    expect(t.has('auth')).toBe(true);
    expect(t.has('common')).toBe(true);
  });
});

describe('a translator with no catalog', () => {
  it('answers with keys instead of throwing', () => {
    const t = emptyTranslator('fr');

    expect(t.locale).toBe('fr');
    expect(t.t('auth.form.title')).toBe('auth.form.title');
    expect(t.has('auth')).toBe(false);
  });
});

describe('the active translator', () => {
  it('is undefined until something activates one', () => {
    deactivate();
    expect(active()).toBeUndefined();
    expect(translate('auth.form.title')).toBeUndefined();
  });

  it('answers from whatever was activated last', async () => {
    activate(await createTranslator({ locale: 'es', namespaces: ['auth'] }));
    expect(translate('auth.form.title')).toBe('Iniciar sesión');

    activate(await createTranslator({ locale: 'fr', namespaces: ['auth'] }));
    expect(translate('auth.form.title')).toBe('Connexion');
  });

  it('answers undefined for a message the active catalog does not carry', async () => {
    // The library asking has an English default; a key on a button is worse
    // than that default.
    activate(await createTranslator({ locale: 'es', namespaces: ['auth'] }));
    expect(translate('issues.actions.archive')).toBeUndefined();
  });
});
