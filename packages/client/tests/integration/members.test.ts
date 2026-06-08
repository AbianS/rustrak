import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import { NotFoundError, ValidationError } from '../../src/errors/index.js';
import { server } from '../setup.js';

describe('MembersResource Integration', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('list()', () => {
    it('should list project members', async () => {
      const members = await client.members.list(1);

      expect(members).toHaveLength(2);
      expect(members[0]?.user_id).toBe(1);
      expect(members[0]?.email).toBe('test@example.com');
      expect(members[0]?.role).toBe('editor');
      expect(members[1]?.role).toBe('admin');
    });

    it('should surface 404 for unknown project', async () => {
      await expect(client.members.list(999)).rejects.toThrow(NotFoundError);
    });

    it('should reject malformed response', async () => {
      server.use(
        http.get('http://localhost:8080/api/projects/1/members', () => {
          return HttpResponse.json([{ user_id: 'x' }]);
        }),
      );

      await expect(client.members.list(1)).rejects.toThrow(ValidationError);
    });
  });

  describe('upsert()', () => {
    it('should add or update a member', async () => {
      await expect(
        client.members.upsert(1, { user_id: 1, role: 'editor' }),
      ).resolves.toBeUndefined();
    });

    it('should validate role client-side', async () => {
      await expect(
        // @ts-expect-error - testing runtime validation
        client.members.upsert(1, { user_id: 1, role: 'owner' }),
      ).rejects.toThrow(ValidationError);
    });

    it('should surface 404 for unknown project', async () => {
      await expect(
        client.members.upsert(999, { user_id: 1, role: 'viewer' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should surface 409 when downgrading the last project admin', async () => {
      await expect(
        client.members.upsert(1, { user_id: 2, role: 'viewer' }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('remove()', () => {
    it('should remove a member', async () => {
      await expect(client.members.remove(1, 1)).resolves.toBeUndefined();
    });

    it('should surface 404 for unknown membership', async () => {
      await expect(client.members.remove(1, 999)).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should surface 409 when removing the last project admin', async () => {
      await expect(client.members.remove(1, 2)).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });
});
