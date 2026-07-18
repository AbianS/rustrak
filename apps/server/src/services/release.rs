use chrono::Utc;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::models::{is_valid_version, CreateRelease, Release, UpdateRelease};

const RELEASE_COLUMNS: &str = "id, project_id, version, ref, url, date_created, date_released";

pub struct ReleaseService;

impl ReleaseService {
    /// Creates a release for `(project_id, version)`.
    ///
    /// Idempotent by design: if the row already exists, the existing release
    /// is returned with `created = false` instead of erroring — matches
    /// sentry-cli's expectation that repeating `releases new` never fails.
    pub async fn create(
        pool: &DbPool,
        project_id: i32,
        input: CreateRelease,
    ) -> AppResult<(Release, bool)> {
        let version = input.version.trim();
        if !is_valid_version(version) {
            return Err(AppError::Validation(format!(
                "Invalid release version: {:?}",
                input.version
            )));
        }

        // date_created is bound explicitly (not left to the column's SQL-level
        // DEFAULT) so every row's timestamp goes through the same sqlx/chrono
        // encoding path. On SQLite, `date_created` is a TEXT column — mixing a
        // `datetime('now')`-generated string ("2026-07-18 16:30:33") with a
        // sqlx-bound `DateTime<Utc>` ("2026-07-18T16:30:33+00:00") would make
        // `date_created < $2` compare two different textual formats
        // lexicographically instead of chronologically (`' '` < `'T'` in
        // ASCII, so a DEFAULT-inserted row can spuriously compare as "older"
        // than it really is). Binding consistently avoids the mismatch.
        let now = Utc::now();
        let query = format!(
            r#"
            INSERT INTO releases (project_id, version, ref, url, date_created)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING {RELEASE_COLUMNS}
            "#
        );

        let result = sqlx::query_as::<_, Release>(sqlx::AssertSqlSafe(&*query))
            .bind(project_id)
            .bind(version)
            .bind(&input.reference)
            .bind(&input.url)
            .bind(now)
            .fetch_one(pool)
            .await;

        match result {
            Ok(release) => Ok((release, true)),
            Err(sqlx::Error::Database(ref db_err)) if db_err.is_unique_violation() => {
                let existing = Self::get_by_version(pool, project_id, version).await?;
                Ok((existing, false))
            }
            Err(e) => Err(AppError::Database(e)),
        }
    }

    /// Fetches a release by `(project_id, version)`.
    pub async fn get_by_version(
        pool: &DbPool,
        project_id: i32,
        version: &str,
    ) -> AppResult<Release> {
        let version = version.trim();
        let query = format!(
            "SELECT {RELEASE_COLUMNS} FROM releases WHERE project_id = $1 AND version = $2"
        );

        sqlx::query_as::<_, Release>(sqlx::AssertSqlSafe(&*query))
            .bind(project_id)
            .bind(version)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Release {} not found", version)))
    }

    /// Generic partial update (`ref`, `url`, `dateReleased`). Setting
    /// `date_released` IS "finalize" — there is no separate status flag.
    /// Fields left `None` in `input` keep their stored value (`COALESCE`).
    pub async fn finalize(
        pool: &DbPool,
        project_id: i32,
        version: &str,
        input: UpdateRelease,
    ) -> AppResult<Release> {
        let version = version.trim();
        let query = format!(
            r#"
            UPDATE releases
            SET ref = COALESCE($3, ref),
                url = COALESCE($4, url),
                date_released = COALESCE($5, date_released)
            WHERE project_id = $1 AND version = $2
            RETURNING {RELEASE_COLUMNS}
            "#
        );

        sqlx::query_as::<_, Release>(sqlx::AssertSqlSafe(&*query))
            .bind(project_id)
            .bind(version)
            .bind(&input.reference)
            .bind(&input.url)
            .bind(input.date_released)
            .fetch_one(pool)
            .await
            .map_err(|error| match error {
                sqlx::Error::RowNotFound => {
                    AppError::NotFound(format!("Release {} not found", version))
                }
                other => other.into(),
            })
    }
}
