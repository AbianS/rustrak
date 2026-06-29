/**
 * Exercises Sentry Crons (monitor check-ins) through the REAL @sentry/node SDK,
 * so we test the exact wire format the SDK produces — the `check_in` envelope
 * item with an embedded `monitor_config` for upsert — not a hand-rolled
 * payload. If Rustrak auto-creates the monitor and records these check-ins, a
 * Sentry SDK can't tell the difference.
 *
 * What this demonstrates:
 *   - Sentry.withMonitor(): wraps a job, auto-sends in_progress then ok/error
 *     with the measured duration, and upserts the monitor schedule.
 *   - A failing job → status "error" (the monitor flips to error).
 *   - Sentry.captureCheckIn(): the lower-level API (manual in_progress → ok),
 *     showing the check_in_id lifecycle.
 *
 * "missed" and "timeout" are NOT sent here — Rustrak's monitor worker computes
 * those server-side from the schedule + max_runtime.
 *
 * Usage:
 *   SENTRY_DSN=http://<sentry_key>@localhost:8080/<project_id> pnpm demo:crons
 * Default DSN targets project 1 on a local server.
 */
import * as Sentry from '@sentry/node';

const DSN =
  process.env.SENTRY_DSN ??
  'http://0cabb1ed295f4cf6b41411220caa8eb6@localhost:8080/1';
const RELEASE = process.env.SENTRY_RELEASE ?? 'demo@1.0.0';
const ENV = process.env.SENTRY_ENV ?? 'production';

Sentry.init({
  dsn: DSN,
  release: RELEASE,
  environment: ENV,
  defaultIntegrations: false,
});

/** Pretend a job runs for a bit. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Sending monitor check-ins via @sentry/node to ${DSN}\n`);

  // 1. A healthy daily job (crontab). withMonitor upserts the monitor's
  //    schedule via monitor_config, sends in_progress, then ok + duration.
  await Sentry.withMonitor(
    'nightly-backup',
    async () => {
      await sleep(400);
      console.log('  ✓ nightly-backup ran ok');
    },
    {
      schedule: { type: 'crontab', value: '0 0 * * *' },
      checkinMargin: 5, // minutes late before "missed"
      maxRuntime: 30, // minutes before "timeout"
      timezone: 'America/New_York',
    },
  );

  // 2. An interval job (every 5 minutes), also healthy.
  await Sentry.withMonitor(
    'cache-warmer',
    async () => {
      await sleep(200);
      console.log('  ✓ cache-warmer ran ok');
    },
    {
      schedule: { type: 'interval', value: 5, unit: 'minute' },
      maxRuntime: 2,
    },
  );

  // 3. A job that throws → the SDK reports status "error" and re-throws.
  try {
    await Sentry.withMonitor(
      'report-generator',
      async () => {
        await sleep(150);
        throw new Error('Report template not found');
      },
      {
        schedule: { type: 'crontab', value: '*/15 * * * *' },
      },
    );
  } catch {
    console.log('  ✗ report-generator failed (reported as error)');
  }

  // 4. The lower-level API: a manual in_progress → ok lifecycle sharing one
  //    check_in_id, so the closing check-in updates the open row.
  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: 'weekly-digest', status: 'in_progress' },
    { schedule: { type: 'interval', value: 1, unit: 'week' } },
  );
  await sleep(300);
  Sentry.captureCheckIn({
    checkInId,
    monitorSlug: 'weekly-digest',
    status: 'ok',
    duration: 0.3,
  });
  console.log('  ✓ weekly-digest manual check-in (in_progress → ok)');

  // Flush the batched check-ins before exiting.
  await Sentry.flush(2000);
  console.log('\n✓ Flushed. Open the Crons tab to see the monitors.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
