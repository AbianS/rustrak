import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  colorTokens,
  durationTokens,
  easeTokens,
  fontTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  textTokens,
} from './tokens';

const source = readFileSync(
  fileURLToPath(new URL('../styles/tokens.css', import.meta.url)),
  'utf8',
);

/* The file's comments talk about `@layer` and about tokens; without stripping
   them, any assertion about the CSS ends up reading the prose. */
const css = source.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Names declared inside an `@theme` block for one namespace. The reset
 * (`--color-*: initial`) and the modifiers (`--text-body--line-height`) are
 * skipped: neither produces a utility of its own.
 */
function declaredIn(namespace: string): string[] {
  const themeBlocks = css.match(/@theme[^{]*\{[\s\S]*?\n\}/g) ?? [];
  const names = new Set<string>();

  for (const block of themeBlocks) {
    // The lookbehind stops the modifiers being read as tokens: there is no
    // `--font-weight` token inside `--text-body--font-weight`.
    const pattern = new RegExp(
      `(?<![-\\w])--${namespace}-([a-z0-9-]+)\\s*:`,
      'g',
    );
    for (const match of block.matchAll(pattern)) {
      const name = match[1];
      if (name == null || name.includes('--')) continue;
      names.add(name);
    }
  }

  return [...names];
}

describe('tokens.ts mirrors tokens.css', () => {
  const cases: [string, string, readonly string[]][] = [
    ['color', 'colorTokens', colorTokens],
    ['text', 'textTokens', textTokens],
    ['spacing', 'spacingTokens', spacingTokens],
    ['radius', 'radiusTokens', radiusTokens],
    ['shadow', 'shadowTokens', shadowTokens],
    ['font', 'fontTokens', fontTokens],
    ['transition-duration', 'durationTokens', durationTokens],
    ['ease', 'easeTokens', easeTokens],
  ];

  it.each(cases)('--%s-* matches %s', (namespace, _exportName, declared) => {
    expect([...declared].sort()).toEqual(declaredIn(namespace).sort());
  });
});

describe('the system is closed', () => {
  it("resets Tailwind's inherited namespaces", () => {
    for (const namespace of [
      'color',
      'shadow',
      'font',
      'text',
      'radius',
      'ease',
    ]) {
      expect(css).toContain(`--${namespace}-*: initial;`);
    }
  });

  it('declares the tokens outside any @layer', () => {
    // A token inside an @layer loses to Tailwind's utilities, and the theme
    // switch silently stops applying.
    expect(css).not.toMatch(/@layer/);
  });

  it('gives every dark semantic token a light value', () => {
    const namesIn = (selector: string) => {
      const block = css.match(
        new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`),
      )?.[1];
      return new Set(
        [...(block ?? '').matchAll(/^\s{2}(--[a-z0-9-]+)\s*:/gm)].map(
          ([, token]) => token,
        ),
      );
    };

    // Dark is the reference theme and sits on `:root`; light is the opt-out.
    const dark = namesIn(':root,\\n\\[data-theme="dark"\\]');
    const light = namesIn('\\[data-theme="light"\\]');

    expect(dark.size).toBeGreaterThan(50);
    expect([...dark].filter((token) => !light.has(token))).toEqual([]);
  });

  it('keeps the primitives out of the published layer', () => {
    // A `--rk-*` reaching Tailwind would mean a component could write a raw
    // value and stay inside the linting rules.
    const themeBlocks = css.match(/@theme[^{]*\{[\s\S]*?\n\}/g) ?? [];
    for (const block of themeBlocks) {
      expect(block).not.toMatch(/--color-rk-/);
    }
  });
});
