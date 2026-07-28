import type { Result, RustrakError, ServerVersion } from '@rustrak/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '@/shared/config/constants';

const getVersion = vi.fn<() => Promise<Result<ServerVersion, RustrakError>>>();

vi.mock('@/shared/api/rustrak', () => ({
  createClient: async () => ({ health: { getVersion } }),
}));

/**
 * A feed that advertises something newer than *both* candidate versions, so no
 * test can pass by accident: whichever number the check compares against, this
 * feed has an update for it. The only thing that can stop a banner is refusing
 * to compare at all.
 */
const feed = {
  versions: [
    { version: '0.9.0', description: 'old', url: 'https://example.test/0.9.0' },
    {
      version: '99.0.0',
      description: 'Shiny',
      url: 'https://example.test/99.0.0',
    },
  ],
};

function respondWith(body: unknown, ok = true) {
  return vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

async function subject() {
  const { checkForUpdate } = await import('@/shared/api/version-check');
  return checkForUpdate();
}

/** None of these is a version. Each is "we could not read the version". */
const outages: RustrakError[] = [
  { kind: 'network', message: 'unreachable', reason: 'unreachable' },
  { kind: 'network', message: 'timed out', reason: 'timeout' },
  { kind: 'server_error', status: 500, message: 'boom' },
  { kind: 'unauthenticated', status: 401, message: 'Unauthorized' },
  { kind: 'forbidden', status: 403, message: 'Forbidden' },
  { kind: 'not_found', status: 404, message: 'Not found' },
  { kind: 'invalid_response', message: 'bad body' },
];

describe('checkForUpdate', () => {
  beforeEach(() => {
    getVersion.mockReset();
    vi.stubGlobal('fetch', respondWith(feed));
    vi.stubEnv('RUSTRAK_VERSION_CHECK_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reports an update against the version the server reported', async () => {
    getVersion.mockResolvedValue({
      success: true,
      data: { version: '0.13.0' },
    });

    await expect(subject()).resolves.toEqual({
      state: 'update-available',
      info: {
        current: '0.13.0',
        latest: '99.0.0',
        description: 'Shiny',
        url: 'https://example.test/99.0.0',
      },
    });
  });

  it('reports up-to-date, not unknown, when nothing in the feed is newer', async () => {
    getVersion.mockResolvedValue({
      success: true,
      data: { version: '100.0.0' },
    });

    await expect(subject()).resolves.toEqual({ state: 'up-to-date' });
  });

  it('reports disabled without asking anyone', async () => {
    vi.stubEnv('RUSTRAK_VERSION_CHECK_ENABLED', 'false');
    const fetchSpy = respondWith(feed);
    vi.stubGlobal('fetch', fetchSpy);

    await expect(subject()).resolves.toEqual({ state: 'disabled' });
    expect(getVersion).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('separates a failed feed from a feed with no update', async () => {
    getVersion.mockResolvedValue({
      success: true,
      data: { version: '0.13.0' },
    });
    vi.stubGlobal('fetch', respondWith({}, false));

    await expect(subject()).resolves.toEqual({
      state: 'unknown',
      reason: 'feed',
    });
  });

  it('does not let the catch swallow a client failure', async () => {
    // A throw from `fetch` is the catch doing its job. It must still not be
    // the thing that reports an unreadable *server version*: the two failures
    // are separated by `reason`, and this asserts the catch never claims one it
    // did not handle.
    getVersion.mockResolvedValue({
      success: false,
      error: { kind: 'network', message: 'unreachable', reason: 'unreachable' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('should never be reached');
      }),
    );

    await expect(subject()).resolves.toEqual({
      state: 'unknown',
      reason: 'server-version',
    });
  });

  /**
   * The regression this whole change exists to prevent.
   *
   * The old line was `(await getServerVersion())?.version ?? APP_VERSION`: with
   * the server unreachable it compared the *frontend's* bundled version against
   * the feed and then put a banner on every page from the answer. Perfectly
   * typed, perfectly narrowed, and about the wrong process. Nothing but an
   * assertion on the branch can see it.
   */
  for (const error of outages) {
    it(`refuses to check, and never falls back to APP_VERSION, on ${error.kind}`, async () => {
      getVersion.mockResolvedValue({ success: false, error });

      const result = await subject();

      expect(result).toEqual({ state: 'unknown', reason: 'server-version' });
      expect(result.state).not.toBe('update-available');
      expect(JSON.stringify(result)).not.toContain(APP_VERSION);
    });
  }
});
