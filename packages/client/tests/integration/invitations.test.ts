import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { RustrakClient } from '../../src/client.js';
import {
  NotFoundError,
  RustrakError,
  ValidationError,
} from '../../src/errors/index.js';
import { server } from '../setup.js';

describe('InvitationsResource Integration', () => {
  let client: RustrakClient;

  beforeEach(() => {
    client = new RustrakClient({
      baseUrl: 'http://localhost:8080',
      token: 'test-token',
    });
  });

  describe('create()', () => {
    it('should create an invitation', async () => {
      const invitation = await client.invitations.create({
        email: 'invitee@example.com',
        role: 'member',
      });

      expect(invitation.token).toBe('new-invite-token');
      expect(invitation.email).toBe('invitee@example.com');
      expect(invitation.role).toBe('member');
      expect(invitation.status).toBe('pending');
    });

    it('should validate email client-side', async () => {
      await expect(
        client.invitations.create({ email: 'not-an-email', role: 'member' }),
      ).rejects.toThrow(ValidationError);
    });

    it('should validate role client-side', async () => {
      await expect(
        // @ts-expect-error - testing runtime validation
        client.invitations.create({ email: 'a@b.com', role: 'owner' }),
      ).rejects.toThrow(ValidationError);
    });

    it('should surface 409 when email is already used', async () => {
      await expect(
        client.invitations.create({
          email: 'existing@example.com',
          role: 'member',
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('list()', () => {
    it('should list invitations', async () => {
      const invitations = await client.invitations.list();

      expect(invitations).toHaveLength(1);
      expect(invitations[0]?.email).toBe('invitee@example.com');
      expect(invitations[0]?.role).toBe('member');
    });

    it('should reject malformed response', async () => {
      server.use(
        http.get('http://localhost:8080/api/invitations', () => {
          return HttpResponse.json([{ token: 123 }]);
        }),
      );

      await expect(client.invitations.list()).rejects.toThrow(ValidationError);
    });
  });

  describe('revoke()', () => {
    it('should revoke an invitation', async () => {
      await expect(
        client.invitations.revoke('invite-token-abc123'),
      ).resolves.toBeUndefined();
    });

    it('should surface 404 for unknown invitation', async () => {
      await expect(client.invitations.revoke('unknown-token')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw a RustrakError subclass on failure', async () => {
      await expect(
        client.invitations.revoke('unknown-token'),
      ).rejects.toBeInstanceOf(RustrakError);
    });
  });
});
