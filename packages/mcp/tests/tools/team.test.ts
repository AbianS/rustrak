import { SERVER_ERROR_MESSAGE } from '@rustrak/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEnv, fail, ok } from '../setup.js';

describe('team tools', () => {
  let mockClient: any;
  let testEnv: Awaited<ReturnType<typeof createTestEnv>>;
  let callTool: Awaited<ReturnType<typeof createTestEnv>>['callTool'];

  beforeEach(async () => {
    mockClient = {
      team: {
        list: vi.fn(),
        updateRole: vi.fn(),
        remove: vi.fn(),
      },
      invitations: {
        create: vi.fn(),
        list: vi.fn(),
        revoke: vi.fn(),
      },
      members: {
        list: vi.fn(),
        upsert: vi.fn(),
        remove: vi.fn(),
      },
    };
    testEnv = await createTestEnv(mockClient);
    callTool = testEnv.callTool;
  });

  afterEach(async () => {
    await testEnv.mcpClient.close();
  });

  describe('list_team_members', () => {
    it('returns the roster', async () => {
      mockClient.team.list.mockResolvedValue(
        ok([{ id: 1, email: 'a@x.com', role: 'admin', is_active: true }]),
      );

      const result = await callTool({
        name: 'list_team_members',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed[0].email).toBe('a@x.com');
    });
  });

  describe('update_member_role', () => {
    it('updates a global role', async () => {
      mockClient.team.updateRole.mockResolvedValue(ok(undefined));

      const result = await callTool({
        name: 'update_member_role',
        arguments: { user_id: 5, role: 'admin' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockClient.team.updateRole).toHaveBeenCalledWith(5, 'admin');
    });
  });

  describe('remove_team_member', () => {
    it('removes a user', async () => {
      mockClient.team.remove.mockResolvedValue(ok(undefined));

      const result = await callTool({
        name: 'remove_team_member',
        arguments: { user_id: 5 },
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0]?.text).toMatch(/removed/i);
      expect(mockClient.team.remove).toHaveBeenCalledWith(5);
    });

    it('does not report success when the void call failed', async () => {
      // A `Result<void>` failure is a value, so it is trivially ignorable.
      // Reporting `User 5 removed.` after a 403 is the regression.
      mockClient.team.remove.mockResolvedValue(
        fail({ kind: 'forbidden', status: 403, message: 'Not allowed' }),
      );

      const result = await callTool({
        name: 'remove_team_member',
        arguments: { user_id: 5 },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).not.toMatch(/removed/i);
      expect(result.content[0]?.text).toContain('Not allowed');
    });
  });

  describe('create_invitation', () => {
    it('creates an invitation and returns the token', async () => {
      mockClient.invitations.create.mockResolvedValue(
        ok({
          token: 'tok_abc',
          email: 'b@x.com',
          role: 'member',
          status: 'pending',
        }),
      );

      const result = await callTool({
        name: 'create_invitation',
        arguments: { email: 'b@x.com', role: 'member' },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.token).toBe('tok_abc');
      expect(mockClient.invitations.create).toHaveBeenCalledWith({
        email: 'b@x.com',
        role: 'member',
      });
    });
  });

  describe('list_invitations', () => {
    it('lists invitations', async () => {
      mockClient.invitations.list.mockResolvedValue(
        ok([{ token: 'tok_abc', email: 'b@x.com', status: 'pending' }]),
      );

      const result = await callTool({
        name: 'list_invitations',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveLength(1);
    });
  });

  describe('revoke_invitation', () => {
    it('revokes an invitation by token', async () => {
      mockClient.invitations.revoke.mockResolvedValue(ok(undefined));

      const result = await callTool({
        name: 'revoke_invitation',
        arguments: { token: 'tok_abc' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockClient.invitations.revoke).toHaveBeenCalledWith('tok_abc');
    });
  });

  describe('list_project_members', () => {
    it('lists project members', async () => {
      mockClient.members.list.mockResolvedValue(
        ok([{ user_id: 2, email: 'c@x.com', role: 'editor' }]),
      );

      const result = await callTool({
        name: 'list_project_members',
        arguments: { project_id: 1 },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed[0].role).toBe('editor');
      expect(mockClient.members.list).toHaveBeenCalledWith(1);
    });
  });

  describe('set_project_member', () => {
    it('upserts a project member', async () => {
      mockClient.members.upsert.mockResolvedValue(ok(undefined));

      const result = await callTool({
        name: 'set_project_member',
        arguments: { project_id: 1, user_id: 2, role: 'viewer' },
      });

      expect(result.isError).toBeFalsy();
      expect(mockClient.members.upsert).toHaveBeenCalledWith(1, {
        user_id: 2,
        role: 'viewer',
      });
    });
  });

  describe('remove_project_member', () => {
    it('removes a project member', async () => {
      mockClient.members.remove.mockResolvedValue(ok(undefined));

      const result = await callTool({
        name: 'remove_project_member',
        arguments: { project_id: 1, user_id: 2 },
      });

      expect(result.isError).toBeFalsy();
      expect(mockClient.members.remove).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('error handling', () => {
    it('returns isError when the client reports a failure', async () => {
      mockClient.team.list.mockResolvedValue(
        fail({
          kind: 'server_error',
          status: 500,
          message: SERVER_ERROR_MESSAGE,
        }),
      );

      const result = await callTool({
        name: 'list_team_members',
        arguments: {},
      });

      expect(result.isError).toBe(true);
    });
  });
});
