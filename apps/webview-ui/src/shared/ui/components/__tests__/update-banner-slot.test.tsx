import type { Result, RustrakError, ServerVersion } from '@rustrak/client';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getVersion = vi.fn<() => Promise<Result<ServerVersion, RustrakError>>>();

vi.mock('@/shared/api/rustrak', () => ({
  createClient: async () => ({ health: { getVersion } }),
}));

// Rendered instead of the real banner: the real one is a fixed-position blob
// of springs, filters and ResizeObserver, none of which this is about. All that
// matters is whether it was asked to render at all, and with which version.
vi.mock('@/shared/ui/components/update-banner', () => ({
  UpdateBanner: ({ info }: { info: { current: string; latest: string } }) => (
    <div data-testid="banner">
      {info.current} to {info.latest}
    </div>
  ),
}));

const feed = {
  versions: [
    {
      version: '99.0.0',
      description: 'Shiny',
      url: 'https://example.test/99.0.0',
    },
  ],
};

async function renderSlot() {
  const { UpdateBannerSlot } = await import(
    '@/shared/ui/components/update-banner-slot'
  );
  render(await UpdateBannerSlot());
}

describe('UpdateBannerSlot', () => {
  beforeEach(() => {
    getVersion.mockReset();
    vi.stubEnv('RUSTRAK_VERSION_CHECK_ENABLED', 'true');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => feed })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('shows the banner when the server reports an older version', async () => {
    getVersion.mockResolvedValue({
      success: true,
      data: { version: '0.13.0' },
    });

    await renderSlot();

    expect(screen.getByTestId('banner')).toHaveTextContent('0.13.0 to 99.0.0');
  });

  /**
   * The regression. The feed here advertises 99.0.0, which is newer than every
   * version this repository will ever ship, so a check that falls back to *any*
   * substitute for the server's version renders a banner and fails this test.
   *
   * A banner is a statement about the version you are running. When that is the
   * one thing we could not read, the only honest render is nothing at all, and
   * no type, no compiler and no `next build` can tell the difference between
   * this and a correct banner. Only this assertion can.
   */
  it('shows no banner when the server version could not be read', async () => {
    getVersion.mockResolvedValue({
      success: false,
      error: { kind: 'network', message: 'unreachable', reason: 'unreachable' },
    });

    await renderSlot();

    expect(screen.queryByTestId('banner')).not.toBeInTheDocument();
  });

  it('shows no banner when the check is disabled', async () => {
    vi.stubEnv('RUSTRAK_VERSION_CHECK_ENABLED', 'false');

    await renderSlot();

    expect(screen.queryByTestId('banner')).not.toBeInTheDocument();
  });

  it('shows no banner when the feed cannot be read', async () => {
    getVersion.mockResolvedValue({
      success: true,
      data: { version: '0.13.0' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    await renderSlot();

    expect(screen.queryByTestId('banner')).not.toBeInTheDocument();
  });
});
