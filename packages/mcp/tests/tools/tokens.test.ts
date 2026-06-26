import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv } from '../setup.js';

describe('token tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  beforeEach(async () => {
    mockClient = {
      tokens: {
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('list_tokens', () => {
    it('returns all tokens (masked)', async () => {
      const mockTokens = [
        {
          id: 1,
          description: 'CI token',
          token_prefix: 'abc',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          description: 'Dev token',
          token_prefix: 'xyz',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockClient.tokens.list.mockResolvedValue(mockTokens);

      const result = await callTool({ name: 'list_tokens', arguments: {} });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].description).toBe('CI token');
    });
  });

  describe('get_token', () => {
    it('retrieves the full token value by ID', async () => {
      const mockToken = {
        id: 1,
        token: 'abc123456789def0123456789abcdef01234567',
        description: 'CI token',
        created_at: '2024-01-01T00:00:00Z',
      };
      mockClient.tokens.get.mockResolvedValue(mockToken);

      const result = await callTool({
        name: 'get_token',
        arguments: { token_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.token).toBe('abc123456789def0123456789abcdef01234567');
      expect(parsed.id).toBe(1);
      expect(mockClient.tokens.get).toHaveBeenCalledWith(1);
    });
  });

  describe('create_token', () => {
    it('creates a new API token', async () => {
      const mockCreated = {
        id: 10,
        description: 'New Token',
        token: 'full-secret-token-abc123',
        token_prefix: 'full',
        created_at: '2024-01-01T00:00:00Z',
      };
      mockClient.tokens.create.mockResolvedValue(mockCreated);

      const result = await callTool({
        name: 'create_token',
        arguments: { description: 'New Token' },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.token).toBe('full-secret-token-abc123');
      expect(mockClient.tokens.create).toHaveBeenCalledWith({
        description: 'New Token',
      });
    });
  });

  describe('revoke_token', () => {
    it('revokes (deletes) a token by ID', async () => {
      mockClient.tokens.delete.mockResolvedValue(undefined);

      const result = await callTool({
        name: 'revoke_token',
        arguments: { token_id: 5 },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.text).toMatch(/revoked/i);
      expect(mockClient.tokens.delete).toHaveBeenCalledWith(5);
    });
  });
});
