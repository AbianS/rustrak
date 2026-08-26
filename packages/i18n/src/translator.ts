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

/*
 * The translator this process is using.
 *
 * A module singleton, which is the same shape `@lingui/core` itself ships:
 * `activate` once at the top, then any module reads it. It exists so a
 * *library* can translate without being handed anything -- `@rustrak/ui` says
 * "Next page" on its own behalf, and neither a prop at every call site nor a
 * React context is an acceptable price for that. A context would also rule the
 * design system out of server components and of any framework that is not
 * React, which is the opposite of what this package is for.
 *
 * One active locale per process. That is right in a browser and in a CLI; it
 * is *not* right in a server rendering concurrently for many readers, which is
 * why `createTranslator` still returns an instance and remains the way an
 * application reads its own copy. This is only for libraries.
 */
let current: Translator | undefined;

export function activate(translator: Translator): void {
  current = translator;
}

export function active(): Translator | undefined {
  return current;
}

/** For tests, and for a caller that wants the process to forget. */
export function deactivate(): void {
  current = undefined;
}

/**
 * The active translation for `key`, or `undefined` when nothing is activated
 * or the catalog has no such message.
 *
 * `undefined` rather than the key: a library asking for its own copy has a
 * sensible English default to fall back to, and showing `ui.nextPage` on a
 * button would be worse than showing "Next page".
 */
export function translate(
  key: MessageKey,
  values?: Values,
): string | undefined {
  if (!current) return undefined;
  const text = current.t(key, values);
  return text === key ? undefined : text;
}
