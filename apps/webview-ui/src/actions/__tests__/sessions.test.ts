import type {
  Result,
  RustrakError,
  SessionSummary,
  SessionTimeseries,
} from '@rustrak/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const summary = vi.fn<() => Promise<Result<SessionSummary, RustrakError>>>();
const timeseries =
  vi.fn<() => Promise<Result<SessionTimeseries, RustrakError>>>();

vi.mock('@/lib/rustrak', () => ({
  createClient: async () => ({ sessions: { summary, timeseries } }),
}));

/**
 * A window in which the project genuinely reported nothing.
 *
 * Byte for byte what `EMPTY_SESSION_SUMMARY` used to be returned on failure,
 * which is the whole problem: this is a legitimate answer, so a fetch that
 * failed could not be told apart from a quiet Tuesday.
 */
const quietWindow: SessionSummary = {
  total: 0,
  errored: 0,
  crashed: 0,
  abnormal: 0,
  crash_free_sessions_rate: null,
  crash_free_users_rate: null,
  active_releases: 0,
};

const busyWindow: SessionSummary = {
  total: 4210,
  errored: 30,
  crashed: 12,
  abnormal: 1,
  crash_free_sessions_rate: 0.997,
  crash_free_users_rate: 0.998,
  active_releases: 3,
};

/** None of these is "the project reported nothing". Each is "we do not know". */
const outages: RustrakError[] = [
  { kind: 'network', message: 'unreachable', reason: 'unreachable' },
  { kind: 'network', message: 'timed out', reason: 'timeout' },
  { kind: 'server_error', status: 500, message: 'boom' },
  { kind: 'server_error', status: 503, message: 'boom' },
  { kind: 'forbidden', status: 403, message: 'Forbidden' },
  { kind: 'not_found', status: 404, message: 'Not found' },
  { kind: 'invalid_response', message: 'bad body' },
  { kind: 'rate_limited', status: 429, message: 'Slow down' },
];

describe('getSessionSummary', () => {
  beforeEach(() => {
    summary.mockReset();
  });

  async function subject() {
    const { getSessionSummary } = await import('@/actions/sessions');
    return getSessionSummary(1, '24h');
  }

  it('passes a measured summary through untouched', async () => {
    summary.mockResolvedValue({ success: true, data: busyWindow });

    await expect(subject()).resolves.toEqual({
      success: true,
      data: busyWindow,
    });
  });

  it('reports a genuinely empty window as a success', async () => {
    summary.mockResolvedValue({ success: true, data: quietWindow });

    await expect(subject()).resolves.toEqual({
      success: true,
      data: quietWindow,
    });
  });

  for (const error of outages) {
    // The regression this suite exists for. A zeroed `SessionSummary` is a
    // fully narrowed, perfectly typed success, so neither `tsc` nor
    // `next build` can see the difference between "no crashes" and "we could
    // not ask". Only an assertion on the branch can.
    it(`fails, never fabricates zeroes, on ${error.kind}`, async () => {
      summary.mockResolvedValue({ success: false, error });

      const result = await subject();

      expect(result).toEqual({ success: false, error });
      expect(result.success).toBe(false);
      expect(result).not.toEqual({ success: true, data: quietWindow });
    });
  }
});

describe('getSessionTimeseries', () => {
  beforeEach(() => {
    timeseries.mockReset();
  });

  async function subject() {
    const { getSessionTimeseries } = await import('@/actions/sessions');
    return getSessionTimeseries(1, '24h', 1);
  }

  it('reports a genuinely empty series as a success', async () => {
    timeseries.mockResolvedValue({ success: true, data: [] });

    await expect(subject()).resolves.toEqual({ success: true, data: [] });
  });

  for (const error of outages) {
    it(`fails, never fabricates an empty series, on ${error.kind}`, async () => {
      timeseries.mockResolvedValue({ success: false, error });

      const result = await subject();

      expect(result).toEqual({ success: false, error });
      expect(result).not.toEqual({ success: true, data: [] });
    });
  }
});
