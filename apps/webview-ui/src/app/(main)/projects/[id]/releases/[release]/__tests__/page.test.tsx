import type {
  Issue,
  Project,
  ReleaseHealthRow,
  Result,
  RustrakError,
} from '@rustrak/client';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getNewIssuesForRelease =
  vi.fn<() => Promise<Result<Issue[], RustrakError>>>();

const project = { id: 1, name: 'Checkout' } as Project;
const rows = [{ environment: 'production' }] as ReleaseHealthRow[];

vi.mock('@/actions/projects', () => ({
  getProject: async () => ({ success: true, data: project }),
}));
vi.mock('@/actions/sessions', () => ({
  getAllReleaseHealthRows: async () => ({ success: true, data: rows }),
}));
vi.mock('@/actions/releases', () => ({
  getNewIssuesForRelease: () => getNewIssuesForRelease(),
}));
vi.mock('../release-environment-cards', () => ({
  ReleaseEnvironmentCards: () => <div>environment cards</div>,
}));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));

async function renderPage() {
  const { default: ReleaseDetailPage } = await import('../page');
  render(
    await ReleaseDetailPage({
      params: Promise.resolve({ id: '1', release: '1.4.0' }),
      searchParams: Promise.resolve({}),
    }),
  );
}

describe('release detail, new issues panel', () => {
  beforeEach(() => {
    getNewIssuesForRelease.mockReset();
  });

  it('claims no new issues only when the release reported none', async () => {
    getNewIssuesForRelease.mockResolvedValue({ success: true, data: [] });

    await renderPage();

    expect(screen.getByText(/no new issues introduced/i)).toBeInTheDocument();
  });

  // The panel degrades; the page does not. The environment cards are the
  // release's real content and were fetched successfully, so they stay -- but
  // the panel must not answer a question it failed to ask.
  it('degrades the panel alone, and never to "no new issues"', async () => {
    getNewIssuesForRelease.mockResolvedValue({
      success: false,
      error: { kind: 'network', message: 'unreachable', reason: 'unreachable' },
    });

    await renderPage();

    expect(screen.getByText('environment cards')).toBeInTheDocument();
    expect(screen.getByText(/could not be reached/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/no new issues introduced/i),
    ).not.toBeInTheDocument();
  });
});
