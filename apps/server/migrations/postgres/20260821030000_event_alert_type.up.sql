-- VARCHAR, not TEXT: `AlertType` derives sqlx::Type with type_name = "varchar"
-- (models/alert.rs); sqlx's Postgres driver refuses to decode a TEXT column
-- into it at runtime. SQLite is not affected (its migration stays TEXT).
ALTER TABLE events ADD COLUMN alert_type VARCHAR;
