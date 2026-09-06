import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The image pins the dashboard's bind address, and nothing hands it one from
 * the environment it was deployed from.
 *
 * Both halves are the same bug seen from opposite sides. A Next.js standalone
 * server binds to whatever `HOSTNAME` holds, and Docker fills `HOSTNAME` with
 * the container id on any image that leaves it unset -- so an image that does
 * not pin it listens on one interface whose name resolves nowhere else. That
 * is what `ENV HOSTNAME="0.0.0.0"` fixes, and it is what lets a reverse proxy
 * reach the container with no host port published.
 *
 * Compose has the mirror-image problem. `HOSTNAME=${HOSTNAME:-0.0.0.0}` reads
 * as a courteous default and is a live grenade: every process that runs inside
 * a container already exports `HOSTNAME`, so a CI runner, Portainer or any
 * dockerised deploy tool passes its own container id down into the dashboard,
 * which then dies on `ENOTFOUND` before serving a request. It breaks
 * installations that use no proxy at all, which is why the rule is blanket
 * rather than a warning in the docs.
 *
 * Neither half is reachable from a normal test -- one is an image, the other a
 * deployment file -- so this reads them as text, the way every other rule in
 * this folder reads source.
 */

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
);

const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

/** Every Compose file shipped as a starting point for an installation. */
const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.dev.yml'];

/**
 * `HOST` is here beside `HOSTNAME` for the server, whose `HOST` defaults to
 * `0.0.0.0` in `config.rs` already. Forwarding it buys nothing and carries the
 * same shape of risk, so neither name belongs in a Compose file.
 */
const BIND_ADDRESS_KEY = /^\s*-?\s*(HOSTNAME|HOST)\s*[=:]/;

describe('dashboard bind address', () => {
  it('is pinned to 0.0.0.0 by the image', () => {
    const dockerfile = read('apps/webview-ui/Dockerfile');

    expect(dockerfile).toMatch(/^ENV HOSTNAME="0\.0\.0\.0"$/m);
  });

  it('is not resolved at startup from a HOST alias', () => {
    // Next.js standalone reads `HOSTNAME` and only `HOSTNAME`. A `CMD` that
    // maps `HOST` onto it cannot work under the `ENV` above, which always
    // wins, so the alias is documentation for behaviour that does not exist.
    const dockerfile = read('apps/webview-ui/Dockerfile');

    expect(dockerfile).not.toMatch(/\$\{HOST[:\-}]/);
  });

  it.each(COMPOSE_FILES)(
    'is not forwarded from the ambient environment in %s',
    (file) => {
      const forwarded = read(file)
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('#'))
        .filter((line) => BIND_ADDRESS_KEY.test(line));

      expect(forwarded).toEqual([]);
    },
  );
});
