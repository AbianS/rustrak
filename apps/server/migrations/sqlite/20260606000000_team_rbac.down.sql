-- Revert team management & project-level RBAC

DROP INDEX IF EXISTS idx_auth_tokens_user;
ALTER TABLE auth_tokens DROP COLUMN user_id;

DROP TABLE invitations;
DROP TABLE project_members;

ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
UPDATE users SET is_admin = 1 WHERE role = 'admin';
ALTER TABLE users DROP COLUMN role;
