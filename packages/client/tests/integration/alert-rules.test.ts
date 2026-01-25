import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';
import { server } from '../setup.js';

describe('AlertRulesResource Integration', () => {
  let client: RustrakClient;
  const projectId = 1;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('list()', () => {
    it('should fetch all alert rules for a project', async () => {
      const rules = await client.alertRules.list(projectId);

      expect(rules).toHaveLength(2);
      expect(rules[0]?.name).toBe('New Issue Alert');
      expect(rules[0]?.alert_type).toBe('new_issue');
      expect(rules[1]?.name).toBe('Regression Alert');
      expect(rules[1]?.alert_type).toBe('regression');
    });

    it('should validate response schema', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects/1/alert-rules', () => {
          return HttpResponse.json([
            {
              id: 1,
              project_id: 1,
              name: 'Invalid',
              alert_type: 'invalid_type', // Invalid alert type
              is_enabled: true,
              conditions: {},
              cooldown_minutes: 0,
              channel_ids: [],
              created_at: '2026-01-20T10:00:00.000Z',
              updated_at: '2026-01-20T10:00:00.000Z',
            },
          ]);
        }),
      );

      await expect(client.alertRules.list(projectId)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should handle empty array', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects/1/alert-rules', () => {
          return HttpResponse.json([]);
        }),
      );

      const rules = await client.alertRules.list(projectId);
      expect(rules).toHaveLength(0);
    });

    it('should return rules for specific project only', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects/2/alert-rules', () => {
          return HttpResponse.json([]);
        }),
      );

      const rules = await client.alertRules.list(2);
      expect(rules).toHaveLength(0);
    });
  });

  describe('get()', () => {
    it('should fetch single rule by id', async () => {
      const rule = await client.alertRules.get(projectId, 1);

      expect(rule.id).toBe(1);
      expect(rule.name).toBe('New Issue Alert');
      expect(rule.alert_type).toBe('new_issue');
      expect(rule.is_enabled).toBe(true);
      expect(rule.channel_ids).toEqual([1, 2]);
    });

    it('should throw NotFoundError for non-existent rule', async () => {
      await expect(client.alertRules.get(projectId, 999)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should validate datetime format', async () => {
      const rule = await client.alertRules.get(projectId, 1);

      expect(new Date(rule.created_at).toISOString()).toBe(rule.created_at);
      expect(new Date(rule.updated_at).toISOString()).toBe(rule.updated_at);
    });

    it('should handle nullable last_triggered_at', async () => {
      const rule = await client.alertRules.get(projectId, 2);

      expect(rule.last_triggered_at).toBeNull();
    });

    it('should include conditions object', async () => {
      const rule = await client.alertRules.get(projectId, 1);

      expect(rule.conditions).toBeDefined();
      expect(typeof rule.conditions).toBe('object');
    });
  });

  describe('create()', () => {
    it('should create new_issue rule', async () => {
      const rule = await client.alertRules.create(projectId, {
        name: 'New Alert Rule',
        alert_type: 'new_issue',
        channel_ids: [1],
      });

      expect(rule.name).toBe('New Alert Rule');
      expect(rule.alert_type).toBe('new_issue');
      expect(rule.id).toBe(3);
      expect(rule.is_enabled).toBe(true);
      expect(rule.channel_ids).toEqual([1]);
    });

    it('should create regression rule', async () => {
      const rule = await client.alertRules.create(projectId, {
        name: 'Regression Rule',
        alert_type: 'regression',
        channel_ids: [1, 2],
      });

      expect(rule.alert_type).toBe('regression');
    });

    it('should create unmute rule', async () => {
      const rule = await client.alertRules.create(projectId, {
        name: 'Unmute Rule',
        alert_type: 'unmute',
        channel_ids: [2],
      });

      expect(rule.alert_type).toBe('unmute');
    });

    it('should create rule with cooldown', async () => {
      const rule = await client.alertRules.create(projectId, {
        name: 'Cooldown Rule',
        alert_type: 'new_issue',
        channel_ids: [1],
        cooldown_minutes: 30,
      });

      expect(rule.cooldown_minutes).toBe(30);
    });

    it('should create rule with custom conditions', async () => {
      const rule = await client.alertRules.create(projectId, {
        name: 'Conditional Rule',
        alert_type: 'new_issue',
        channel_ids: [1],
        conditions: { min_events: 5 },
      });

      expect(rule.conditions).toEqual({ min_events: 5 });
    });

    it('should create disabled rule', async () => {
      const rule = await client.alertRules.create(projectId, {
        name: 'Disabled Rule',
        alert_type: 'new_issue',
        channel_ids: [1],
        is_enabled: false,
      });

      expect(rule.is_enabled).toBe(false);
    });

    it('should reject empty name', async () => {
      await expect(
        client.alertRules.create(projectId, {
          name: '',
          alert_type: 'new_issue',
          channel_ids: [1],
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject invalid alert type', async () => {
      await expect(
        client.alertRules.create(projectId, {
          name: 'Test',
          // @ts-expect-error - Testing runtime validation
          alert_type: 'invalid',
          channel_ids: [1],
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject empty channel_ids', async () => {
      await expect(
        client.alertRules.create(projectId, {
          name: 'Test',
          alert_type: 'new_issue',
          channel_ids: [],
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update()', () => {
    it('should update rule name', async () => {
      const updated = await client.alertRules.update(projectId, 1, {
        name: 'Updated Rule Name',
      });

      expect(updated.name).toBe('Updated Rule Name');
      expect(updated.id).toBe(1);
    });

    it('should update rule enabled state', async () => {
      const updated = await client.alertRules.update(projectId, 1, {
        is_enabled: false,
      });

      expect(updated.is_enabled).toBe(false);
    });

    it('should update channel_ids', async () => {
      const updated = await client.alertRules.update(projectId, 1, {
        channel_ids: [2],
      });

      expect(updated.channel_ids).toEqual([2]);
    });

    it('should update cooldown', async () => {
      const updated = await client.alertRules.update(projectId, 1, {
        cooldown_minutes: 120,
      });

      expect(updated.cooldown_minutes).toBe(120);
    });

    it('should update conditions', async () => {
      const updated = await client.alertRules.update(projectId, 1, {
        conditions: { min_events: 10 },
      });

      expect(updated.conditions).toEqual({ min_events: 10 });
    });

    it('should throw NotFoundError for non-existent rule', async () => {
      await expect(
        client.alertRules.update(projectId, 999, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should update timestamp', async () => {
      const original = await client.alertRules.get(projectId, 1);
      const updated = await client.alertRules.update(projectId, 1, {
        name: 'Updated',
      });

      expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(original.updated_at).getTime(),
      );
    });
  });

  describe('delete()', () => {
    it('should delete rule successfully', async () => {
      await expect(
        client.alertRules.delete(projectId, 1),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundError for non-existent rule', async () => {
      await expect(client.alertRules.delete(projectId, 999)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('listHistory()', () => {
    it('should fetch alert history for a project', async () => {
      const history = await client.alertRules.listHistory(projectId);

      expect(history).toHaveLength(2);
      expect(history[0]?.alert_type).toBe('new_issue');
      expect(history[0]?.status).toBe('sent');
      expect(history[1]?.status).toBe('failed');
    });

    it('should validate response schema', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects/1/alert-history', () => {
          return HttpResponse.json([
            {
              id: 1,
              alert_type: 'new_issue',
              channel_type: 'webhook',
              channel_name: 'Test',
              status: 'invalid_status', // Invalid status
              attempt_count: 1,
              idempotency_key: 'key-1',
              created_at: '2026-01-20T10:00:00.000Z',
            },
          ]);
        }),
      );

      await expect(client.alertRules.listHistory(projectId)).rejects.toThrow(
        ValidationError,
      );
    });

    it('should handle empty history', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects/1/alert-history', () => {
          return HttpResponse.json([]);
        }),
      );

      const history = await client.alertRules.listHistory(projectId);
      expect(history).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      const history = await client.alertRules.listHistory(projectId, {
        limit: 1,
      });

      expect(history).toHaveLength(1);
    });

    it('should include all required fields', async () => {
      const history = await client.alertRules.listHistory(projectId);
      const item = history[0];

      expect(item).toBeDefined();
      expect(item?.id).toBeDefined();
      expect(item?.alert_type).toBeDefined();
      expect(item?.channel_type).toBeDefined();
      expect(item?.channel_name).toBeDefined();
      expect(item?.status).toBeDefined();
      expect(item?.attempt_count).toBeDefined();
      expect(item?.idempotency_key).toBeDefined();
      expect(item?.created_at).toBeDefined();
    });

    it('should include optional fields when present', async () => {
      const history = await client.alertRules.listHistory(projectId);
      const sentItem = history.find((h) => h.status === 'sent');
      const failedItem = history.find((h) => h.status === 'failed');

      expect(sentItem?.sent_at).toBeDefined();
      expect(sentItem?.http_status_code).toBe(200);
      expect(failedItem?.error_message).toBe('Slack API timeout');
      expect(failedItem?.http_status_code).toBe(504);
    });
  });
});
