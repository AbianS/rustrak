import type { Messages } from '@lingui/core';
import { setupI18n } from '@lingui/core';
import { catalogs, type Namespace } from './generated/catalogs.js';
import type { MessageKey } from './generated/keys.js';
import { DEFAULT_LOCALE, type Locale } from './locales.js';

export type { Namespace } from './generated/catalogs.js';
export { NAMESPACES } from './generated/catalogs.js';
export type { MessageKey } from './generated/keys.js';

export type Values = Record<string, unknown>;

export interface Translator {
  readonly locale: Locale;
  /**
   * The message for `key`. Falls back to the key itself, which is a legible
   * failure: a screen showing `issues.empty.title` says which message is
   * missing, where an empty string says only that something is wrong.
   */
  t(key: MessageKey, values?: Values): string;
  /** Whether `namespace` has been loaded for the active locale. */
  has(namespace: Namespace): boolean;
}

export interface CreateTranslatorOptions {
  locale?: Locale;
  /**
   * Which namespaces to load. Loading all thirty costs 16 KB gzip; a page
   * that names the four it uses costs a fraction of that.
   */
  namespaces: readonly Namespace[];
}

/**
 * A translator for one locale and a chosen set of namespaces.
 *
 * Async because the catalogs are separate chunks: this is the one place that
 * awaits, so nothing downstream has to deal with a half-loaded dictionary.
 *
 * There is no React here and no global. A caller holds its own instance, which
 * is what lets the same package serve a browser, a Node process and a React
 * Native app without any of them agreeing on a framework.
 */
export async function createTranslator({
  locale = DEFAULT_LOCALE,
  namespaces,
}: CreateTranslatorOptions): Promise<Translator> {
  const loaded = await Promise.all(
    namespaces.map(async (namespace) => {
      const load = catalogs[namespace]?.[locale];
      if (!load) return {};
      const module = await load();
      return module.default as Messages;
    }),
  );

  const messages: Messages = Object.assign({}, ...loaded);

  const i18n = setupI18n({
    locale,
    messages: { [locale]: messages },
  });

  const present = new Set(namespaces);

  return {
    locale,
    t(key, values) {
      // `_` returns the id when the message is absent, which is the fallback
      // this contract promises.
      return i18n._(key, values);
    },
    has(namespace) {
      return present.has(namespace);
    },
  };
}

/**
 * A translator that knows nothing, for a caller with no catalog yet.
 *
 * Returning keys beats throwing: a page that renders before its messages have
 * arrived should show which messages are missing, not fail to render.
 */
export function emptyTranslator(locale: Locale = DEFAULT_LOCALE): Translator {
  return {
    locale,
    t: (key) => key,
    has: () => false,
  };
}
