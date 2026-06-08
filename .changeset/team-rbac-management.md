---
"@rustrak/server": minor
"webview-ui": minor
"@rustrak/client": minor
"@rustrak/mcp": minor
"docs": patch
---

Add team management and project-level RBAC.

**Server (`@rustrak/server`)**
- New `teams`, `team_members`, `project_members` tables with migration
- Team routes: create, get, update, delete, member management
- Project member routes: add/remove members, role assignment (owner/admin/member)
- `access` service: permission checks across all routes
- RBAC extractors and middleware applied to projects, issues, events, source maps, alerts, tokens
- `require_admin` middleware ordering fix on `list_channels`
- Integration tests: `team_rbac_test.rs`

**Client (`@rustrak/client`)**
- New resources: `TeamResource`, `MembersResource`, `InvitationsResource`
- New schemas and types: `team`, `member`, `invitation`
- Updated `UserSchema` with role fields
- Integration tests for all new resources

**UI (`webview-ui`)**
- Settings > Team page: invite members, list members, manage roles
- Pending invitations list with accept/revoke
- Project header with members dialog and role-based actions
- `/invite/[token]` accept invitation flow
- Hide global admins from project add-member list

**MCP (`@rustrak/mcp`)**
- New `team` tools: `list_team_members`, `invite_member`, `remove_member`, `update_member_role`
- Fix alerts tools authorization (`require_admin` ordering)
- Integration and unit tests for team tools

**Docs**
- New `usage/team.mdx`: team management guide
- Updated `sdks/mcp.mdx`: team tools documentation
