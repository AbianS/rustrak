import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { NotFoundError } from '../../src/errors/index.js';

describe('TokensResource Integration', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('list()', () => {
    it('should fetch all tokens (masked)', async () => {
      const tokens = await client.tokens.list();

      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.token_prefix).toBe('abc12345...');
      expect(tokens[0]?.description).toBe('Test Token');
    });

    it('should validate datetime format', async () => {
      const tokens = await client.tokens.list();
      const token = tokens[0];

      expect(token).toBeDefined();
      expect(new Date(token!.created_at).toISOString()).toBe(token!.created_at);
    });

    it('should handle null fields', async () => {
      const tokens = await client.tokens.list();
      const token = tokens[0];

      expect(token).toBeDefined();
      // description and last_used_at can be null
      expect(['string', 'object']).toContain(typeof token!.last_used_at);
    });
  });

  describe('get()', () => {
    it('should fetch single token (masked)', async () => {
      const token = await client.tokens.get(1);

      expect(token.id).toBe(1);
      expect(token.token_prefix).toBe('abc12345...');
      expect(token.description).toBe('Test Token');
    });

    it('should throw NotFoundError for non-existent token', async () => {
      await expect(client.tokens.get(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('create()', () => {
    it('should create token with description', async () => {
      const created = await client.tokens.create({
        description: 'New Token',
      });

      expect(created.id).toBe(2);
      expect(created.token).toBe('abc123456789def');
      expect(created.description).toBe('New Token');
      expect(created.created_at).toBeDefined();
    });

    it('should create token without description', async () => {
      const created = await client.tokens.create({});

      expect(created.id).toBe(2);
      expect(created.token).toBe('abc123456789def');
      expect(created.description).toBeNull();
    });

    it('should return full token only on creation', async () => {
      const created = await client.tokens.create({
        description: 'Test',
      });

      // Full token is returned
      expect(created.token).toBeTruthy();
      expect(created.token.length).toBeGreaterThan(8);
      // created response has 'token', not 'token_prefix'
      expect(created).not.toHaveProperty('token_prefix');
      expect(created).toHaveProperty('token');
    });
  });

  describe('delete()', () => {
    it('should delete token successfully', async () => {
      await expect(client.tokens.delete(1)).resolves.toBeUndefined();
    });

    it('should throw NotFoundError for non-existent token', async () => {
      await expect(client.tokens.delete(999)).rejects.toThrow(NotFoundError);
    });
  });
});
