export const LOCALES = ['en', 'es', 'fr', 'ro', 'zh'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * `zh-Hans-CN` and `ZH` both reach `zh`. Region and script are dropped because
 * the catalogs are per language: there is no `zh-TW` to fall back to.
 */
function baseTag(tag: string): string {
  const base = tag.split('-')[0] ?? '';
  return base.toLowerCase();
}

/** One `Accept-Language` entry, with its q-value. */
interface Preference {
  tag: string;
  quality: number;
}

function parseAcceptLanguage(header: string): Preference[] {
  return header
    .split(',')
    .map((part): Preference | null => {
      const [tag, ...params] = part.trim().split(';');
      if (!tag) return null;

      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2);
      const quality = q === undefined ? 1 : Number.parseFloat(q);

      // `q=0` means "explicitly not this one", not "no preference".
      if (!Number.isFinite(quality) || quality <= 0) return null;
      return { tag: tag.trim(), quality };
    })
    .filter((p): p is Preference => p !== null)
    .sort((a, b) => b.quality - a.quality);
}

export interface ResolveLocaleOptions {
  /** What the reader chose, stored on their account. Wins outright. */
  stored?: string | null;
  /** The `Accept-Language` header, for anyone who has not chosen. */
  acceptLanguage?: string | null;
  /** `navigator.languages`, for a client with no header to read. */
  preferred?: readonly string[] | null;
}

/**
 * Which language to answer in.
 *
 * The stored preference wins because it lives on the account: it follows the
 * reader to any browser they sign in from, which a header cannot do. Only then
 * the browser's list, and English last.
 */
export function resolveLocale({
  stored,
  acceptLanguage,
  preferred,
}: ResolveLocaleOptions = {}): Locale {
  if (stored) {
    const base = baseTag(stored);
    if (isLocale(base)) return base;
  }

  const tags = [
    ...(preferred ?? []),
    ...(acceptLanguage
      ? parseAcceptLanguage(acceptLanguage).map((p) => p.tag)
      : []),
  ];

  for (const tag of tags) {
    if (tag === '*') return DEFAULT_LOCALE;
    const base = baseTag(tag);
    if (isLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}
