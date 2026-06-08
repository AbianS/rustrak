-- Revert team management & project-level RBAC

DROP INDEX IF EXISTS idx_auth_tokens_user;
ALTER TABLE auth_tokens DROP COLUMN user_id;

DROP TABLE invitations;
DROP TABLE project_members;

ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
UPDATE users SET is_admin = true WHERE role = 'admin';
ALTER TABLE users DROP COLUMN role;
