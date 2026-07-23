import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RustrakClient } from '@rustrak/client';
import { z } from 'zod';
import { mcpDone, mcpJson } from '../errors.js';

/**
 * Team management tools: the global user roster + roles, invitations, and
 * per-project membership.
 *
 * NOTE: the team and invitation tools require the configured API token to
 * belong to an instance admin (or be a legacy full-access token). Project
 * member tools require the caller to be a global admin or a project admin of
 * the target project.
 */
export function registerTeamTools(
  server: McpServer,
  client: RustrakClient,
): void {
  // --- Global team roster ---------------------------------------------------

  server.registerTool(
    'list_team_members',
    {
      description:
        'List all users on this Rustrak instance with their global role (admin/member) and status. Requires an admin token.',
      inputSchema: {},
    },
    async () => {
      const result = await client.team.list();
      return mcpJson(result);
    },
  );

  server.registerTool(
    'update_member_role',
    {
      description:
        "Change a user's global role. Admins manage the team and all projects; members only see projects they belong to. The primary user and the last admin cannot be demoted. Requires an admin token.",
      inputSchema: {
        user_id: z.number().int().describe('User ID to update'),
        role: z
          .enum(['admin', 'member'])
          .describe('New global role for the user'),
      },
    },
    async ({ user_id, role }) => {
      const result = await client.team.updateRole(user_id, role);
      return mcpDone(result, `User ${user_id} is now ${role}.`);
    },
  );

  server.registerTool(
    'remove_team_member',
    {
      description:
        'Permanently remove a user from the instance, revoking their access and tokens. The primary user, yourself, and the last admin cannot be removed. Requires an admin token.',
      inputSchema: {
        user_id: z.number().int().describe('User ID to remove'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ user_id }) => {
      const result = await client.team.remove(user_id);
      return mcpDone(result, `User ${user_id} removed.`);
    },
  );

  // --- Invitations ----------------------------------------------------------

  server.registerTool(
    'create_invitation',
    {
      description:
        'Invite a person by email with a global role. Returns a single-use, expiring invite token; share the link `<app-url>/invite/<token>` manually (no email is sent). Requires an admin token.',
      inputSchema: {
        email: z.string().email().describe('Email address of the invitee'),
        role: z
          .enum(['admin', 'member'])
          .describe('Global role the invited user will receive'),
      },
    },
    async ({ email, role }) => {
      const result = await client.invitations.create({ email, role });
      return mcpJson(result);
    },
  );

  server.registerTool(
    'list_invitations',
    {
      description:
        'List invitations (pending, accepted, revoked) with their tokens, roles and expiry. Requires an admin token.',
      inputSchema: {},
    },
    async () => {
      const result = await client.invitations.list();
      return mcpJson(result);
    },
  );

  server.registerTool(
    'revoke_invitation',
    {
      description:
        'Revoke a pending invitation by its token so it can no longer be accepted. Requires an admin token.',
      inputSchema: {
        token: z.string().describe('Invitation token to revoke'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ token }) => {
      const result = await client.invitations.revoke(token);
      return mcpDone(result, 'Invitation revoked.');
    },
  );

  // --- Per-project membership ----------------------------------------------

  server.registerTool(
    'list_project_members',
    {
      description:
        'List the members of a project with their per-project role (viewer/editor/admin). Requires global admin or project-admin access.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
      },
    },
    async ({ project_id }) => {
      const result = await client.members.list(project_id);
      return mcpJson(result);
    },
  );

  server.registerTool(
    'set_project_member',
    {
      description:
        'Add a user to a project or change their per-project role. viewer = read issues/events; editor = also resolve/delete issues and update the project; admin = also delete the project and manage its members. Requires global admin or project-admin access.',
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        user_id: z.number().int().describe('User ID to add or update'),
        role: z
          .enum(['viewer', 'editor', 'admin'])
          .describe('Per-project role to assign'),
      },
    },
    async ({ project_id, user_id, role }) => {
      const result = await client.members.upsert(project_id, { user_id, role });
      return mcpDone(
        result,
        `User ${user_id} is now ${role} on project ${project_id}.`,
      );
    },
  );

  server.registerTool(
    'remove_project_member',
    {
      description:
        "Remove a user's access to a project. The last project admin cannot be removed. Requires global admin or project-admin access.",
      inputSchema: {
        project_id: z.number().int().describe('Project ID'),
        user_id: z
          .number()
          .int()
          .describe('User ID to remove from the project'),
      },
      annotations: { destructiveHint: true },
    },
    async ({ project_id, user_id }) => {
      const result = await client.members.remove(project_id, user_id);
      return mcpDone(
        result,
        `User ${user_id} removed from project ${project_id}.`,
      );
    },
  );
}
