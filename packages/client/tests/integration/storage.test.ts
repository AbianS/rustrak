import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/index.js';
import { expectErr, expectOk } from '../helpers/result.js';
import { server } from '../setup.js';

const client = new RustrakClient({
  baseUrl: 'http://localhost:8080',
  token: 'test-token',
});

describe('StorageResource', () => {
  describe('getSummary()', () => {
    it('returns the instance-wide storage summary', async () => {
      const summary = expectOk(await client.storage.getSummary());

      expect(summary.total_db_size_bytes).toBe(1048576);
      expect(summary.events_count).toBe(120);
      expect(summary.transactions_count).toBe(80);
      expect(summary.spans_count).toBe(640);
      expect(summary.logs_count).toBe(200);
      expect(summary.source_maps.total_bytes).toBe(650);
      expect(summary.source_maps.file_count).toBe(2);
    });
  });

  describe('getProjects()', () => {
    it('returns the per-project storage breakdown', async () => {
      const rows = expectOk(await client.storage.getProjects());

      expect(rows).toHaveLength(2);
      expect(rows[0].project_name).toBe('Test Project');
      expect(rows[0].events_count).toBe(100);
      expect(rows[0].logs_count).toBe(200);
      expect(rows[0].source_maps_count).toBe(2);
      expect(rows[1].events_count).toBe(0);
    });
  });

  describe('previewCleanup()', () => {
    it('returns the dry-run counts without deleting', async () => {
      const counts = expectOk(
        await client.storage.previewCleanup({
          older_than_days: 30,
        }),
      );

      expect(counts.events).toBe(20);
      expect(counts.transactions).toBe(10);
      expect(counts.spans).toBe(80);
      expect(counts.logs).toBe(50);
      expect(counts.issues_removed).toBe(3);
    });

    it('accepts a project scope', async () => {
      const counts = expectOk(
        await client.storage.previewCleanup({
          older_than_days: 30,
          project_id: 1,
        }),
      );
      expect(counts).toBeDefined();
    });

    it('rejects a non-positive retention window before sending a request', async () => {
      const preview = await client.storage.previewCleanup({
        older_than_days: 0,
      });
      expect(preview.success).toBe(false);
      expect(expectErr(preview).kind).toBe('invalid_request');

      const executed = await client.storage.executeCleanup({
        older_than_days: -1,
      });
      expect(executed.success).toBe(false);
      expect(expectErr(executed).kind).toBe('invalid_request');
    });
  });

  describe('executeCleanup()', () => {
    it('returns the counts of removed rows', async () => {
      const counts = expectOk(
        await client.storage.executeCleanup({
          older_than_days: 30,
        }),
      );

      expect(counts.events).toBe(20);
      expect(counts.issues_removed).toBe(3);
    });

    it('forwards the data-type selection flags in the request body', async () => {
      let sentBody: Record<string, unknown> | undefined;
      server.use(
        http.post(
          'http://localhost:8080/api/storage/cleanup',
          async ({ request }) => {
            sentBody = (await request.json()) as Record<string, unknown>;
            return HttpResponse.json({
              events: 0,
              transactions: 0,
              spans: 0,
              logs: 50,
              issues_removed: 0,
            });
          },
        ),
      );

      expectOk(
        await client.storage.executeCleanup({
          older_than_days: 30,
          include_events: false,
          include_transactions: false,
          include_logs: true,
        }),
      );

      expect(sentBody).toMatchObject({
        older_than_days: 30,
        include_events: false,
        include_transactions: false,
        include_logs: true,
      });
    });
  });

  describe('previewGcSourceMaps()', () => {
    it('returns the orphaned files a GC would remove', async () => {
      const result = expectOk(await client.storage.previewGcSourceMaps());

      expect(result.files_removed).toBe(4);
      expect(result.bytes_freed).toBe(81920);
    });
  });

  describe('gcSourceMaps()', () => {
    it('returns the orphaned files removed and bytes freed', async () => {
      const result = expectOk(await client.storage.gcSourceMaps());

      expect(result.files_removed).toBe(4);
      expect(result.bytes_freed).toBe(81920);
    });
  });
});
