import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { projectFiles } from 'archunit';
import { describe, expect, it } from 'vitest';

/**
 * No slice imports a sibling slice.
 *
 * This is what stops the domain layer becoming a web. The layer rule alone does
 * not: eleven slices that all import each other still point downward, and still
 * mean that touching `issue` can break `release`. The value of a slice is that
 * you can read it, move it or delete it without reading the other ten, and that
 * is only true if nothing crosses sideways.
 *
 * When a screen needs two features, the **page** composes them. `app/` is above
 * both and may import both freely, so composition has a home that costs no
 * coupling. That is the whole trade: one import in a page instead of a
 * permanent edge between two domains.
 *
 * **Two slices sharing a word is not a violation.** `agent-trace` and
 * `transaction` both speak of spans and neither imports the other, because they
 * do not mean the same thing: `agent-trace` reads rows of the `spans` table via
 * `@rustrak/client`, and `transaction` reads the `spans` array embedded in an
 * event payload, declared in its own `model/span.ts`. Had they been one type,
 * the I/O matrix says it moves *down* into `shared` rather than sideways.
 */

// The one place the suite still touches the filesystem, and only to enumerate
// slice *names*. archunit answers questions about files, not about which
// directories exist, and `it.each` needs the list before any rule runs.
const slices = readdirSync(join(resolve(__dirname, '../..'), 'features'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe('slices do not import each other', () => {
  // Read from disk rather than hardcoded, so a slice added later is covered
  // without anyone remembering to add it here. The floor is what keeps that
  // honest: if the read ever returns nothing, `it.each` would generate zero
  // tests and the file would pass by running nothing at all.
  it('covers the population it expects to cover', () => {
    // 11 after phase 6: the ten the spec derived, plus `storage`, which became
    // a slice during the shared-layer pass rather than staying with its page.
    expect(slices.length).toBeGreaterThanOrEqual(11);
  });

  it.each(slices)('%s imports no sibling slice', async (slice) => {
    const rule = projectFiles()
      .inFolder(`src/features/${slice}/**`)
      .shouldNot()
      .dependOnFiles()
      .inFolder('src/features/**', {
        except: { inFolder: `src/features/${slice}/**` },
      });

    await expect(rule).toPassAsync();
  });
});
