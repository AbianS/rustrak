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

/** The file's comments talk about `@layer` and about tokens: left in, any
 * assertion over the CSS ends up reading the prose instead. */
const css = source.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Names declared inside a `@theme` block for one namespace. The reset
 * (`--color-*: initial`) and the modifiers (`--text-body--line-height`) are
 * dropped: neither generates a utility of its own.
 */
function declaredIn(namespace: string): string[] {
  const themeBlocks = css.match(/@theme[^{]*\{[\s\S]*?\n\}/g) ?? [];
  const names = new Set<string>();

  for (const block of themeBlocks) {
    // The lookbehind stops modifiers being read as tokens: there is no
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
  it('resets the namespaces inherited from Tailwind', () => {
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

  it('defines tokens outside any @layer', () => {
    // A token inside @layer loses against Tailwind's utilities and the theme
    // switch stops applying.
    expect(css).not.toMatch(/@layer/);
  });

  it('never publishes a primitive straight to Tailwind', () => {
    // Layer 3 may only point at layer 2. Publishing `--rk-*` without going
    // through a semantic token is what would stop a light theme from being a
    // thirty-line block, because the component would be tied to the raw value.
    const inlineBlock = css.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? '';
    const primitives = [...inlineBlock.matchAll(/var\(--(rk-[a-z0-9-]+)\)/g)];

    expect(primitives.map(([, name]) => name)).toEqual([]);
  });
});
