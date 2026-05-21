import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';
import { server } from '../setup.js';

describe('AlertIntegrationsResource Integration', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('list()', () => {
    it('should fetch all alert integrations', async () => {
      const integrations = await client.alertIntegrations.list();

      expect(integrations).toHaveLength(2);
      expect(integrations[0]?.name).toBe('Production Webhook');
      expect(integrations[0]?.provider_type).toBe('webhook');
      expect(integrations[1]?.name).toBe('Slack Alerts');
      expect(integrations[1]?.provider_type).toBe('slack');
    });

    it('should validate response schema', async () => {
      server.use(
        http.get('http://localhost:8080/api/integrations', () => {
          return HttpResponse.json([
            {
              id: 1,
              name: 'Invalid',
              provider_type: 'invalid_type', // Invalid provider type
              credentials: {},
              is_enabled: true,
              failure_count: 0,
              created_at: '2026-01-20T10:00:00.000Z',
              updated_at: '2026-01-20T10:00:00.000Z',
            },
          ]);
        }),
      );

      await expect(client.alertIntegrations.list()).rejects.toThrow(
        ValidationError,
      );
    });

    it('should handle empty array', async () => {
      server.use(
        http.get('http://localhost:8080/api/integrations', () => {
          return HttpResponse.json([]);
        }),
      );

      const integrations = await client.alertIntegrations.list();
      expect(integrations).toHaveLength(0);
    });
  });

  describe('get()', () => {
    it('should fetch single integration by id', async () => {
      const integration = await client.alertIntegrations.get(1);

      expect(integration.id).toBe(1);
      expect(integration.name).toBe('Production Webhook');
      expect(integration.provider_type).toBe('webhook');
      expect(integration.credentials).toEqual({
        url: 'https://example.com/webhook',
        secret: 'webhook-secret',
      });
    });

    it('should throw NotFoundError for non-existent integration', async () => {
      await expect(client.alertIntegrations.get(999)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should validate datetime format', async () => {
      const integration = await client.alertIntegrations.get(1);

      expect(new Date(integration.created_at).toISOString()).toBe(
        integration.created_at,
      );
      expect(new Date(integration.updated_at).toISOString()).toBe(
        integration.updated_at,
      );
    });

    it('should handle nullable fields', async () => {
      const integration = await client.alertIntegrations.get(1);

      expect(integration.last_failure_at).toBeNull();
      expect(integration.last_failure_message).toBeNull();
    });
  });

  describe('create()', () => {
    it('should create webhook integration', async () => {
      const integration = await client.alertIntegrations.create({
        name: 'New Webhook',
        provider_type: 'webhook',
        credentials: {
          url: 'https://new.example.com/webhook',
        },
      });

      expect(integration.name).toBe('New Webhook');
      expect(integration.provider_type).toBe('webhook');
      expect(integration.id).toBe(3);
      expect(integration.is_enabled).toBe(true);
    });

    it('should create slack integration', async () => {
      const integration = await client.alertIntegrations.create({
        name: 'Slack Bot',
        provider_type: 'slack',
        credentials: {
          method: 'bot_token',
          token: 'xoxb-test-token',
        },
      });

      expect(integration.provider_type).toBe('slack');
    });

    it('should create email integration', async () => {
      const integration = await client.alertIntegrations.create({
        name: 'Email Alerts',
        provider_type: 'email',
        credentials: {
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_username: 'alerts@example.com',
          smtp_password: 'secret',
          from_address: 'alerts@example.com',
        },
      });

      expect(integration.provider_type).toBe('email');
    });

    it('should create integration with disabled state', async () => {
      const integration = await client.alertIntegrations.create({
        name: 'Disabled Integration',
        provider_type: 'webhook',
        credentials: { url: 'https://example.com' },
        is_enabled: false,
      });

      expect(integration.is_enabled).toBe(false);
    });

    it('should reject empty name', async () => {
      await expect(
        client.alertIntegrations.create({
          name: '',
          provider_type: 'webhook',
          credentials: { url: 'https://example.com' },
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject invalid provider type', async () => {
      await expect(
        client.alertIntegrations.create({
          name: 'Test',
          // @ts-expect-error - Testing runtime validation
          provider_type: 'invalid',
          credentials: {},
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('update()', () => {
    it('should update integration name', async () => {
      const updated = await client.alertIntegrations.update(1, {
        name: 'Updated Webhook Name',
      });

      expect(updated.name).toBe('Updated Webhook Name');
      expect(updated.id).toBe(1);
    });

    it('should update integration credentials', async () => {
      const updated = await client.alertIntegrations.update(1, {
        credentials: {
          url: 'https://updated.example.com/webhook',
          secret: 'new-secret',
        },
      });

      expect(updated.credentials).toEqual({
        url: 'https://updated.example.com/webhook',
        secret: 'new-secret',
      });
    });

    it('should disable integration', async () => {
      const updated = await client.alertIntegrations.update(1, {
        is_enabled: false,
      });

      expect(updated.is_enabled).toBe(false);
    });

    it('should throw NotFoundError for non-existent integration', async () => {
      await expect(
        client.alertIntegrations.update(999, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should update timestamp', async () => {
      const original = await client.alertIntegrations.get(1);
      const updated = await client.alertIntegrations.update(1, {
        name: 'Updated',
      });

      expect(new Date(updated.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(original.updated_at).getTime(),
      );
    });
  });

  describe('delete()', () => {
    it('should delete integration successfully', async () => {
      await expect(client.alertIntegrations.delete(1)).resolves.toBeUndefined();
    });

    it('should throw NotFoundError for non-existent integration', async () => {
      await expect(client.alertIntegrations.delete(999)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('test()', () => {
    it('should send test notification without routing override', async () => {
      const result = await client.alertIntegrations.test(1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Test notification sent successfully');
    });

    it('should send test notification with routing override', async () => {
      server.use(
        http.post(
          'http://localhost:8080/api/integrations/2/test',
          async ({ request }) => {
            const body = (await request.json()) as {
              routing_override?: Record<string, unknown>;
            };
            return HttpResponse.json({
              success: true,
              message: `Test sent to ${body.routing_override?.channel ?? 'unknown'}`,
            });
          },
        ),
      );

      const result = await client.alertIntegrations.test(2, {
        channel: '#alerts',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Test sent to #alerts');
    });

    it('should throw NotFoundError for non-existent integration', async () => {
      await expect(client.alertIntegrations.test(999)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should handle test failure', async () => {
      server.use(
        http.post('http://localhost:8080/api/integrations/1/test', () => {
          return HttpResponse.json({
            success: false,
            message: 'Connection timeout',
          });
        }),
      );

      const result = await client.alertIntegrations.test(1);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection timeout');
    });
  });
});
