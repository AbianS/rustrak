import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';
import { server } from '../setup.js';

describe('AlertChannelsResource Integration', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('list()', () => {
    it('should fetch all notification channels', async () => {
      const channels = await client.alertChannels.list();

      expect(channels).toHaveLength(2);
      expect(channels[0]?.name).toBe('Production Webhook');
      expect(channels[0]?.channel_type).toBe('webhook');
      expect(channels[1]?.name).toBe('Slack Alerts');
      expect(channels[1]?.channel_type).toBe('slack');
    });

    it('should validate response schema', async () => {
      server.use(
        http.get('http://localhost:8080/api/alert-channels', () => {
          return HttpResponse.json([
            {
              id: 1,
              name: 'Invalid',
              channel_type: 'invalid_type', // Invalid channel type
              config: {},
              is_enabled: true,
              failure_count: 0,
              created_at: '2026-01-20T10:00:00.000Z',
              updated_at: '2026-01-20T10:00:00.000Z',
            },
          ]);
        }),
      );

      await expect(client.alertChannels.list()).rejects.toThrow(
        ValidationError,
      );
    });

    it('should handle empty array', async () => {
      server.use(
        http.get('http://localhost:8080/api/alert-channels', () => {
          return HttpResponse.json([]);
        }),
      );

      const channels = await client.alertChannels.list();
      expect(channels).toHaveLength(0);
    });
  });

  describe('get()', () => {
    it('should fetch single channel by id', async () => {
      const channel = await client.alertChannels.get(1);

      expect(channel.id).toBe(1);
      expect(channel.name).toBe('Production Webhook');
      expect(channel.channel_type).toBe('webhook');
      expect(channel.config).toEqual({
        url: 'https://example.com/webhook',
        secret: 'webhook-secret',
      });
    });

    it('should throw NotFoundError for non-existent channel', async () => {
      await expect(client.alertChannels.get(999)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should validate datetime format', async () => {
      const channel = await client.alertChannels.get(1);

      expect(new Date(channel.created_at).toISOString()).toBe(
        channel.created_at,
      );
      expect(new Date(channel.updated_at).toISOString()).toBe(
        channel.updated_at,
      );
    });

    it('should handle nullable fields', async () => {
      const channel = await client.alertChannels.get(1);

      expect(channel.last_failure_at).toBeNull();
      expect(channel.last_failure_message).toBeNull();
    });
  });

  describe('create()', () => {
    it('should create webhook channel', async () => {
      const channel = await client.alertChannels.create({
        name: 'New Webhook',
        channel_type: 'webhook',
        config: {
          url: 'https://new.example.com/webhook',
        },
      });

      expect(channel.name).toBe('New Webhook');
      expect(channel.channel_type).toBe('webhook');
      expect(channel.id).toBe(3);
      expect(channel.is_enabled).toBe(true);
    });

    it('should create slack channel', async () => {
      const channel = await client.alertChannels.create({
        name: 'Slack Channel',
        channel_type: 'slack',
        config: {
          webhook_url: 'https://hooks.slack.com/services/NEW',
          channel: '#dev-alerts',
        },
      });

      expect(channel.channel_type).toBe('slack');
    });

    it('should create email channel', async () => {
      const channel = await client.alertChannels.create({
        name: 'Email Alerts',
        channel_type: 'email',
        config: {
          recipients: ['alerts@example.com'],
        },
      });

      expect(channel.channel_type).toBe('email');
    });

    it('should create channel with disabled state', async () => {
      const channel = await client.alertChannels.create({
        name: 'Disabled Channel',
        channel_type: 'webhook',
        config: { url: 'https://example.com' },
        is_enabled: false,
      });

      expect(channel.is_enabled).toBe(false);
    });

    it('should reject empty name', async () => {
      await expect(
        client.alertChannels.create({
          name: '',
          channel_type: 'webhook',
          config: { url: 'https://example.com' },
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject invalid channel type', async () => {
      await expect(
        client.alertChannels.create({
          name: 'Test',
          // @ts-expect-error - Testing runtime validation
          channel_type: 'invalid',
          config: {},
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update()', () => {
    it('should update channel name', async () => {
      const updated = await client.alertChannels.update(1, {
        name: 'Updated Webhook Name',
      });

      expect(updated.name).toBe('Updated Webhook Name');
      expect(updated.id).toBe(1);
    });

    it('should update channel config', async () => {
      const updated = await client.alertChannels.update(1, {
        config: {
          url: 'https://updated.example.com/webhook',
          secret: 'new-secret',
        },
      });

      expect(updated.config).toEqual({
        url: 'https://updated.example.com/webhook',
        secret: 'new-secret',
      });
    });

    it('should disable channel', async () => {
      const updated = await client.alertChannels.update(1, {
        is_enabled: false,
      });

      expect(updated.is_enabled).toBe(false);
    });

    it('should throw NotFoundError for non-existent channel', async () => {
      await expect(
        client.alertChannels.update(999, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should update timestamp', async () => {
      const original = await client.alertChannels.get(1);
      const updated = await client.alertChannels.update(1, { name: 'Updated' });

      expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(original.updated_at).getTime(),
      );
    });
  });

  describe('delete()', () => {
    it('should delete channel successfully', async () => {
      await expect(client.alertChannels.delete(1)).resolves.toBeUndefined();
    });

    it('should throw NotFoundError for non-existent channel', async () => {
      await expect(client.alertChannels.delete(999)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('test()', () => {
    it('should send test notification successfully', async () => {
      const result = await client.alertChannels.test(1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Test notification sent successfully');
    });

    it('should throw NotFoundError for non-existent channel', async () => {
      await expect(client.alertChannels.test(999)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should handle test failure', async () => {
      server.use(
        http.post('http://localhost:8080/api/alert-channels/1/test', () => {
          return HttpResponse.json({
            success: false,
            message: 'Connection timeout',
          });
        }),
      );

      const result = await client.alertChannels.test(1);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection timeout');
    });
  });
});
