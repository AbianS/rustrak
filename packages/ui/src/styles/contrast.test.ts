import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The contrast the palette actually delivers, pinned.
 *
 * This exists because axe's blanket `color-contrast` rule is switched off in
 * `.storybook/preview.tsx`. Two of the supporting greys sit below AA on
 * purpose, so leaving the rule on would turn every story that used them red and
 * bury the failures that do matter. Switching it off without putting something
 * in its place would mean nobody notices when a palette tweak takes a token
 * from 4.6 to 4.1.
 *
 * So the ratios are numbers in a test. Change a colour and the diff says
 * exactly which pairings moved and by how much, which is the conversation worth
 * having.
 */

const css = readFileSync(
  fileURLToPath(new URL('./tokens.css', import.meta.url)),
  'utf8',
);

/** Reads a primitive straight out of `tokens.css`, so the test cannot drift. */
function primitive(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  if (match?.[1] == null) throw new Error(`no --${name} in tokens.css`);
  return match[1];
}

type Rgb = [number, number, number];

function parse(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) =>
    Number.parseInt(value.slice(i, i + 2), 16),
  ) as Rgb;
}

/** WCAG 2.x relative luminance. */
function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(parse(a)), luminance(parse(b))].sort(
    (x, y) => y - x,
  ) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Flattens a translucent tint onto an opaque background.
 *
 * The severity fills are `rgb(... / 0.1)`, and a ratio computed against the
 * unflattened colour is meaningless: what the eye sees is the composite.
 */
function over(tint: string, alpha: number, base: string): string {
  const [t, b] = [parse(tint), parse(base)];
  return `#${t
    .map((channel, i) =>
      Math.round(channel * alpha + (b[i] as number) * (1 - alpha))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const round = (n: number) => Math.round(n * 100) / 100;

const SURFACE = primitive('rk-ink-800');

describe('text tones on a card surface', () => {
  const cases: [string, string, number][] = [
    ['fg', 'rk-text-1', 16.13],
    ['fg-secondary', 'rk-text-2', 10.4],
    ['fg-tertiary', 'rk-text-3', 6.46],
    ['fg-muted', 'rk-text-4', 5.34],
    ['fg-subtle', 'rk-text-5', 4.31],
    ['fg-ghost', 'rk-text-6', 2.73],
  ];

  it.each(cases)('%s is %s:1', (_token, name, expected) => {
    expect(round(contrast(primitive(name), SURFACE))).toBe(expected);
  });
});

describe('the AA line', () => {
  it('holds for every tone the system uses to carry meaning', () => {
    for (const name of ['rk-text-1', 'rk-text-2', 'rk-text-3', 'rk-text-4']) {
      expect(contrast(primitive(name), SURFACE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * `fg-subtle` and `fg-ghost` do not reach AA, and that is the closed palette
   * of `Rustrak Rediseno v5` rather than an oversight.
   *
   * What makes it safe is that neither ever carries meaning on its own:
   * `fg-subtle` is for a timestamp that is repeated in the row it belongs to,
   * `fg-ghost` for chevrons and rules that the layout already explains. The day
   * one of them becomes the only way to read something, this expectation is the
   * place that argument has to be had.
   */
  it('is knowingly missed by the two decorative greys', () => {
    expect(contrast(primitive('rk-text-5'), SURFACE)).toBeLessThan(4.5);
    expect(contrast(primitive('rk-text-6'), SURFACE)).toBeLessThan(4.5);
  });
});

describe('severity badges', () => {
  // Each fill is the level's own colour at low alpha over the card surface.
  const cases: [string, string, number, number][] = [
    ['fatal', 'rk-fatal', 0.12, 4.55],
    ['error', 'rk-error', 0.1, 4.68],
    ['warning', 'rk-warning', 0.1, 6.61],
    ['info', 'rk-info', 0.1, 4.79],
  ];

  it.each(cases)(
    '%s reads its own colour on its own tint at %s:1',
    (_level, name, alpha, expected) => {
      const colour = primitive(name);
      expect(round(contrast(colour, over(colour, alpha, SURFACE)))).toBe(
        expected,
      );
    },
  );

  /**
   * `debug` is the exception, and the reason `Badge` overrides its foreground.
   * The level is the dimmest in the palette and its tint is built from the same
   * colour, so pairing them gives 2.51:1: fine for a mark, unreadable in a chip.
   */
  it('cannot use its own colour for debug, and does not', () => {
    const debug = primitive('rk-debug');
    const tint = over(debug, 0.12, SURFACE);

    expect(round(contrast(debug, tint))).toBe(2.51);
    // What `Badge` actually renders for that tone.
    expect(contrast(primitive('rk-text-3'), tint)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the lime accent', () => {
  it('carries ink, never white', () => {
    const lime = primitive('rk-lime');

    // The reason `--fg-on-brand` is near-black. White on lime is 1.71:1, which
    // is not a preference.
    expect(contrast('#ffffff', lime)).toBeLessThan(2);
    expect(contrast(primitive('rk-lime-ink'), lime)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('reads as text on the canvas and on a card', () => {
    for (const base of [primitive('rk-canvas'), SURFACE]) {
      expect(contrast(primitive('rk-lime'), base)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
