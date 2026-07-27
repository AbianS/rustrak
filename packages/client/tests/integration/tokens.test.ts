import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { expectErr, expectOk } from '../helpers/result.js';

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
      const tokens = expectOk(await client.tokens.list());

      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.token_prefix).toBe('abc12345...');
      expect(tokens[0]?.description).toBe('Test Token');
    });

    it('should validate datetime format', async () => {
      const tokens = expectOk(await client.tokens.list());
      const token = tokens[0];

      expect(token).toBeDefined();
      expect(new Date(token!.created_at).toISOString()).toBe(token!.created_at);
    });

    it('should handle null fields', async () => {
      const tokens = expectOk(await client.tokens.list());
      const token = tokens[0];

      expect(token).toBeDefined();
      // description and last_used_at can be null
      expect(['string', 'object']).toContain(typeof token!.last_used_at);
    });
  });

  describe('get()', () => {
    it('should fetch single token (full value)', async () => {
      const token = expectOk(await client.tokens.get(1));

      expect(token.id).toBe(1);
      expect(token.token).toBe('abc123456789def0123456789abcdef01234567');
      expect(token.description).toBe('Test Token');
      expect(token.created_at).toBeDefined();
    });

    it('should report not_found for a non-existent token', async () => {
      const result = await client.tokens.get(999);

      expect(result.success).toBe(false);
      const error = expectErr(result);
      expect(error.kind).toBe('not_found');
      expect(error.message).toBe(
        'Resource not found: Token with id 999 not found',
      );
    });
  });

  describe('create()', () => {
    it('should create token with description', async () => {
      const created = expectOk(
        await client.tokens.create({
          description: 'New Token',
        }),
      );

      expect(created.id).toBe(2);
      expect(created.token).toBe('abc123456789def');
      expect(created.description).toBe('New Token');
      expect(created.created_at).toBeDefined();
    });

    it('should create token without description', async () => {
      const created = expectOk(await client.tokens.create({}));

      expect(created.id).toBe(2);
      expect(created.token).toBe('abc123456789def');
      expect(created.description).toBeNull();
    });

    it('should return full token only on creation', async () => {
      const created = expectOk(
        await client.tokens.create({
          description: 'Test',
        }),
      );

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
      const result = await client.tokens.delete(1);

      expect(result.success).toBe(true);
      expect(expectOk(result)).toBeUndefined();
    });

    it('should report not_found for a non-existent token', async () => {
      const result = await client.tokens.delete(999);

      expect(result.success).toBe(false);
      expect(expectErr(result).kind).toBe('not_found');
    });
  });
});
