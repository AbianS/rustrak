import type {
  Result,
  RustrakError,
  SessionSummary,
  SessionTimeseries,
} from '@rustrak/client';
import { render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionSummary =
  vi.fn<() => Promise<Result<SessionSummary, RustrakError>>>();
const getSessionTimeseries =
  vi.fn<() => Promise<Result<SessionTimeseries, RustrakError>>>();

vi.mock('@/features/release/api/queries', () => ({
  getSessionSummary: () => getSessionSummary(),
  getSessionTimeseries: () => getSessionTimeseries(),
}));

// The tile module pulls in the other action files too, and those reach
// `next/headers` on import. Nothing in this suite calls them.
vi.mock('@/shared/api/rustrak', () => ({ createClient: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

/** A window the project genuinely reported nothing in. */
const quietWindow: SessionSummary = {
  total: 0,
  errored: 0,
  crashed: 0,
  abnormal: 0,
  crash_free_sessions_rate: null,
  crash_free_users_rate: null,
  active_releases: 0,
};

const outage: RustrakError = {
  kind: 'network',
  message: 'unreachable',
  reason: 'unreachable',
};

// Resolved once, in a hook, rather than inside the first `it`. Loading the
// tile module pulls its whole transitive graph, and doing that against a
// single test's timeout is what made this file flaky on CI: the first test
// overran, then finished during the second test's window and rendered into its
// DOM. `vi.mock` is hoisted above this, so the mocks are already in place.
let tiles: typeof import('../overview-tiles');

async function renderCrashFree() {
  render(await tiles.CrashFreeTile({ projectId: 1, period: '24h' }));
}

async function renderSessionHealth() {
  render(await tiles.SessionHealthTile({ projectId: 1, period: '24h' }));
}

describe('session tiles on the project overview', () => {
  beforeAll(async () => {
    tiles = await import('../overview-tiles');
  });

  beforeEach(() => {
    getSessionSummary.mockReset();
    getSessionTimeseries.mockReset();
  });

  // This pair is the point of the suite. Both used to render the same pixels:
  // the summary fell back to an all-zero record and the series to `[]`, so an
  // unreachable API produced "no session data" on an error-tracking dashboard.
  // Nothing about that is visible to the type system, to `tsc` or to
  // `next build`, because a zeroed `SessionSummary` is a valid `SessionSummary`.
  it('says nothing was reported only when nothing was reported', async () => {
    getSessionSummary.mockResolvedValue({ success: true, data: quietWindow });
    getSessionTimeseries.mockResolvedValue({ success: true, data: [] });

    await renderCrashFree();

    expect(screen.getByText(/no session data/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not be reached/i)).not.toBeInTheDocument();
  });

  it('reports the outage instead of an empty window when the summary fails', async () => {
    getSessionSummary.mockResolvedValue({ success: false, error: outage });
    getSessionTimeseries.mockResolvedValue({ success: true, data: [] });

    await renderCrashFree();

    expect(screen.getByText(/could not be reached/i)).toBeInTheDocument();
    expect(screen.queryByText(/no session data/i)).not.toBeInTheDocument();
  });

  // The half-measured case: a real headline beside a series we never got would
  // read as a rate with a flat trend behind it, which is a claim about the
  // window rather than about one endpoint.
  it('reports the outage when only the trend fails', async () => {
    getSessionSummary.mockResolvedValue({ success: true, data: quietWindow });
    getSessionTimeseries.mockResolvedValue({ success: false, error: outage });

    await renderCrashFree();

    expect(screen.getByText(/could not be reached/i)).toBeInTheDocument();
    expect(screen.queryByText(/no session data/i)).not.toBeInTheDocument();
  });

  it('draws the session health empty state only for a measured empty series', async () => {
    getSessionTimeseries.mockResolvedValue({ success: true, data: [] });

    await renderSessionHealth();

    expect(
      screen.getByText(/no session data for this period/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/could not be reached/i)).not.toBeInTheDocument();
  });

  it('reports the outage on the session health tile', async () => {
    getSessionTimeseries.mockResolvedValue({ success: false, error: outage });

    await renderSessionHealth();

    expect(screen.getByText(/could not be reached/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/no session data for this period/i),
    ).not.toBeInTheDocument();
  });
});
