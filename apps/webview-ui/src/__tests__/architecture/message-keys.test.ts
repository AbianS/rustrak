import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import { isTestFile } from './predicates';

/**
 * The message dictionaries can drift apart in three ways, and each one
 * rendered a `MISSING_MESSAGE` error in the browser before this suite
 * existed:
 *
 *  1. a key used in code that was never added to the JSON at all
 *     (`commands.close` was called by the command-bar footer and missing
 *     from both locales),
 *  2. a key added to `en` but not `zh` (next-intl renders the key name),
 *  3. a key nested under the wrong namespace, so `useTranslations('x')`
 *     plus `t('y.z')` resolves `x.y.z` which does not exist (`roles.*`
 *     was stored at the top level while the header resolved it through the
 *     `user` namespace).
 *
 * The suite below checks all three statically, over the real source files.
 * The namespace resolution is deliberately simple: a file's hook decides
 * the prefix, and a `t()` call that carries its own full path (global
 * `useTranslations()` or a model-emitted `labelKey`) is resolved as-is.
 * That matches how the code actually calls the translator.
 */

type Messages = Record<string, unknown>;

function leafKeys(obj: Messages, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [name, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${name}` : name;
    if (typeof value === 'string') {
      keys.push(path);
    } else {
      keys.push(...leafKeys(value as Messages, path));
    }
  }
  return keys;
}

function hasKey(obj: Messages, path: string): boolean {
  let current: unknown = obj;
  for (const segment of path.split('.')) {
    if (
      typeof current !== 'object' ||
      current === null ||
      !(segment in current)
    ) {
      return false;
    }
    current = (current as Messages)[segment];
  }
  return typeof current === 'string';
}

const NAMED_HOOK =
  /useTranslations\('([a-zA-Z]+)'\)|getTranslations\('([a-zA-Z]+)'\)/;

const GLOBAL_HOOK = /useTranslations\(\)|getTranslations\(\)/;

const T_CALL = /(?<![a-zA-Z])t(?:\.rich)?\('([a-zA-Z][a-zA-Z0-9.]*)'/g;

describe('message dictionaries stay resolvable', () => {
  it('en and zh expose exactly the same keys', () => {
    const enKeys = leafKeys(en as Messages);
    const zhKeys = leafKeys(zh as Messages);
    const missingInZh = enKeys.filter((key) => !zhKeys.includes(key));
    const extraInZh = zhKeys.filter((key) => !enKeys.includes(key));

    expect(missingInZh).toEqual([]);
    expect(extraInZh).toEqual([]);
    // A floor, not just an empty comparison: 1000+ keys across two locales
    // after the i18n phase, so a glob that stopped matching would fail here
    // rather than pass silently.
    expect(enKeys.length).toBeGreaterThanOrEqual(1000);
  });

  it('every t() call resolves to an existing message key', async () => {
    const rule = projectFiles()
      .inFolder('src/**')
      .shouldNot()
      .adhereTo((file) => {
        if (isTestFile(file.path)) return false;
        if (file.path.split('\\').join('/').includes('/messages/')) {
          return false;
        }

        const named = NAMED_HOOK.exec(file.content);
        const hasGlobal = GLOBAL_HOOK.test(file.content);
        if (!named && !hasGlobal) return false;

        const namespace = named ? named[1] || named[2] : '';

        for (const match of file.content.matchAll(T_CALL)) {
          const key = match[1];
          const full = namespace ? `${namespace}.${key}` : key;
          if (!hasKey(en as Messages, full)) {
            return true;
          }
        }
        return false;
      }, 'calls t() with a message key that does not exist in en.json');

    await expect(rule).toPassAsync();
  });
});
