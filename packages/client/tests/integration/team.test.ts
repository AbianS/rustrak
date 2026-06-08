import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import {
  NotFoundError,
  RustrakError,
  ValidationError,
} from '../../src/errors/index.js';
import { server } from '../setup.js';

describe('TeamResource Integration', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('list()', () => {
    it('should list team members', async () => {
      const members = await client.team.list();

      expect(members).toHaveLength(2);
      expect(members[0]?.email).toBe('test@example.com');
      expect(members[0]?.role).toBe('member');
      expect(members[0]?.is_active).toBe(true);
      expect(members[1]?.role).toBe('admin');
      expect(members[1]?.last_login).toBeNull();
    });

    it('should reject malformed response', async () => {
      server.use(
        http.get('http://localhost:8080/api/team', () => {
          return HttpResponse.json([{ id: 'not-a-number' }]);
        }),
      );

      await expect(client.team.list()).rejects.toThrow(ValidationError);
    });
  });

  describe('updateRole()', () => {
    it('should update a user role', async () => {
      await expect(client.team.updateRole(1, 'admin')).resolves.toBeUndefined();
    });

    it('should reject an invalid role client-side', async () => {
      await expect(
        // @ts-expect-error - testing runtime validation
        client.team.updateRole(1, 'superuser'),
      ).rejects.toThrow(ValidationError);
    });

    it('should surface 404 for unknown user', async () => {
      await expect(client.team.updateRole(999, 'member')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should surface 409 when demoting the last admin', async () => {
      await expect(client.team.updateRole(2, 'member')).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('should throw a RustrakError on 409', async () => {
      await expect(client.team.updateRole(2, 'member')).rejects.toBeInstanceOf(
        RustrakError,
      );
    });
  });

  describe('list() is_primary', () => {
    it('should expose is_primary on the roster', async () => {
      const members = await client.team.list();
      expect(members[1]?.is_primary).toBe(true);
      expect(members[0]?.is_primary).toBe(false);
    });
  });

  describe('remove()', () => {
    it('should delete a user', async () => {
      await expect(client.team.remove(1)).resolves.toBeUndefined();
    });

    it('should surface 404 for unknown user', async () => {
      await expect(client.team.remove(999)).rejects.toThrow(NotFoundError);
    });

    it('should surface 403 when deleting the primary user', async () => {
      await expect(client.team.remove(2)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });
});
