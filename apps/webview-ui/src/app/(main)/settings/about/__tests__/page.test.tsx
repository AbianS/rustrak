import type { Result, RustrakError, ServerVersion } from '@rustrak/client';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getVersion = vi.fn<() => Promise<Result<ServerVersion, RustrakError>>>();

vi.mock('@/lib/rustrak', () => ({
  createClient: async () => ({ health: { getVersion } }),
}));

async function renderPage() {
  const { default: AboutPage } = await import('../page');
  render(await AboutPage());
}

describe('settings/about', () => {
  beforeEach(() => {
    getVersion.mockReset();
  });

  // Deliberately not the version this app bundles: the row has to prove it is
  // showing what the *server* said, and a matching number could not.
  it('shows the version the server reported', async () => {
    getVersion.mockResolvedValue({ success: true, data: { version: '9.9.9' } });

    await renderPage();

    expect(screen.getByText('v9.9.9')).toBeInTheDocument();
    expect(screen.queryByText(/could not read/i)).not.toBeInTheDocument();
  });

  it('says the version could not be read, and shows no number, on failure', async () => {
    getVersion.mockResolvedValue({
      success: false,
      error: { kind: 'network', message: 'unreachable', reason: 'unreachable' },
    });

    await renderPage();

    expect(screen.getByText(/could not read/i)).toBeInTheDocument();
    expect(screen.getByText(/could not be reached/i)).toBeInTheDocument();
    // The rest of the page is real and survives the failed read.
    expect(screen.getByText('Server version')).toBeInTheDocument();
    expect(screen.getByText('GitHub Repository')).toBeInTheDocument();
  });
});
