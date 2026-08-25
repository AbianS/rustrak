import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

/**
 * What a consumer actually ships when it imports one thing from this package.
 *
 * This is the property that rots without being noticed. Everything else here
 * fails loudly -- a broken component fails its story, a drifted token fails
 * `tokens.test.ts` -- but a package that stopped being tree-shakeable looks
 * exactly like one that still is. It builds, it renders, it passes. The only
 * symptom is 800 kB of recharts in an application that draws no charts, and
 * nobody reads a bundle report until something is already slow.
 *
 * It happened. A single-file bundle is one module to a bundler, and inside one
 * module it cannot drop a *module* it never reaches -- it has to prove each
 * statement dead instead. A design system defeats that: top-level `tv()`
 * recipes, an icon catalogue built by calling a factory sixty-one times.
 * Importing `Button` shipped 907 kB.
 *
 * Two things fixed it and both are load-bearing, so each has a test below:
 *
 *   - `unbundle` in `tsdown.config.ts`, so `dist` mirrors `src` and the chart
 *     module is a file the bundler simply never reaches.
 *   - `/* @__PURE__ *\/` on every `fromLucide()` call, so the sixty icons the
 *     import did not ask for can be dropped from the catalogue module.
 *
 * The test needs `dist`, which is why `@rustrak/ui#test` depends on its own
 * `build` in `turbo.json`.
 */

/** Externals a real application provides. Everything else is what it ships. */
const PROVIDED_BY_THE_APP = ['react', 'react-dom', 'react/jsx-runtime'];

/**
 * Bundle `source` the way an application would and return what comes out.
 *
 * `write: false` keeps the output in memory: on disk it would land in the
 * repository, and anything scanning for Tailwind classes would then read a
 * minified copy of the whole design system and emit utilities nothing uses.
 */
async function bundle(source: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'rustrak-ui-shake-'));
  const entry = join(dir, 'entry.js');
  await writeFile(entry, source);

  const result = await build({
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      lib: { entry, formats: ['es'], fileName: 'out' },
      rollupOptions: { external: PROVIDED_BY_THE_APP },
    },
  });

  const [first] = Array.isArray(result) ? result : [];
  const outputs = first?.output ?? [];

  return outputs.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n');
}

/** The built package, addressed the way `exports` publishes it. */
const PACKAGE = new URL('../dist/index.js', import.meta.url).pathname;

/** An application module that imports `names` and nothing else. */
function importing(...names: string[]): string {
  const list = names.join(', ');
  return `import { ${list} } from '${PACKAGE}';\nexport { ${list} };\n`;
}

/** Recharts leaves its class-name prefix all over its own output. */
const carriesRecharts = (code: string) => code.includes('recharts-layer');

/** Every lucide icon is emitted as `"kebab-name",[[` in its node array. */
function lucideIcons(code: string): string[] {
  return [...code.matchAll(/"([a-z]+(?:-[a-z]+)*)",\s*\[\[/g)].map(
    (match) => match[1] as string,
  );
}

describe('what one import costs', () => {
  it('does not ship the chart library to a page with no charts', async () => {
    const code = await bundle(importing('Button'));

    expect(carriesRecharts(code)).toBe(false);
    // The table library is the other heavyweight nothing but `DataTable` uses.
    expect(code).not.toContain('columnFilteringFeature');
  });

  it('ships only the icons that were asked for', async () => {
    const code = await bundle(importing('Button'));

    // Button draws two: the chevron on a menu button and the spinner while
    // loading. The catalogue holds sixty-one.
    const icons = lucideIcons(code);
    expect(icons.sort()).toEqual(['chevron-down', 'loader-circle']);
  });

  it('still ships the chart library to a page that charts', async () => {
    // The control. Without it, a build that silently emitted nothing at all
    // would pass every assertion above.
    const code = await bundle(importing('TimeSeriesChart'));

    expect(carriesRecharts(code)).toBe(true);
  });

  it('keeps one component under a fifth of the whole package', async () => {
    const [button, everything] = await Promise.all([
      bundle(importing('Button')),
      bundle(`export * from '${PACKAGE}';\n`),
    ]);

    // A ratio and not a byte count on purpose: a budget in kilobytes has to be
    // edited every time a component is added, and a number that gets edited to
    // make the build pass is not a budget. This one only moves when the
    // *proportion* a single import drags in gets worse.
    expect(button.length / everything.length).toBeLessThan(0.2);
  });
});
