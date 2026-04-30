//! Rustrak seed binary
//!
//! Idempotent seeder that bootstraps a Rustrak database with deterministic
//! demo data: users, projects (with fixed `sentry_key` UUIDs), and API tokens
//! (with fixed 40-char hex values).
//!
//! Configuration is read from a TOML file (path via `SEEDS_FILE`,
//! default `/app/seeds.toml`).
//!
//! Database connection is taken from the standard `DATABASE_URL` env var,
//! same as the main server.
//!
//! On success, prints the DSN(s) for each project to stdout so SDKs can be
//! configured immediately. Safe to run repeatedly: existing rows are left
//! untouched (matched by unique constraint), missing rows are inserted.

use std::env;
use std::fs;
use std::process::ExitCode;

use serde::Deserialize;
use uuid::Uuid;

use rustrak::config::Config;
use rustrak::db::{self, DbPool};
use rustrak::error::AppResult;
use rustrak::models::CreateUserRequest;
use rustrak::services::UsersService;

#[derive(Debug, Deserialize, Default)]
struct SeedFile {
    #[serde(default)]
    users: Vec<UserSeed>,
    #[serde(default)]
    projects: Vec<ProjectSeed>,
    #[serde(default)]
    tokens: Vec<TokenSeed>,
}

#[derive(Debug, Deserialize)]
struct UserSeed {
    email: String,
    password: String,
    #[serde(default)]
    is_admin: bool,
}

#[derive(Debug, Deserialize)]
struct ProjectSeed {
    name: String,
    slug: String,
    /// Deterministic UUID v4 string. Used as `sentry_key` so the DSN is
    /// stable across runs.
    sentry_key: String,
}

#[derive(Debug, Deserialize)]
struct TokenSeed {
    /// Exactly 40 lowercase hex chars (matches the schema's `CHAR(40)`).
    token: String,
    #[serde(default)]
    description: Option<String>,
}

#[actix_web::main]
async fn main() -> ExitCode {
    dotenvy::dotenv().ok();
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    match run().await {
        Ok(()) => {
            log::info!("Seed complete");
            ExitCode::SUCCESS
        }
        Err(e) => {
            log::error!("Seed failed: {}", e);
            ExitCode::FAILURE
        }
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    // Load seed file
    let seeds_path = env::var("SEEDS_FILE").unwrap_or_else(|_| "/app/seeds.toml".to_string());
    log::info!("Loading seed file: {}", seeds_path);

    let raw = fs::read_to_string(&seeds_path)
        .map_err(|e| format!("Failed to read {}: {}", seeds_path, e))?;
    let seeds: SeedFile = toml::from_str(&raw)
        .map_err(|e| format!("Failed to parse {}: {}", seeds_path, e))?;

    // Validate up-front so we fail fast before touching the DB
    for p in &seeds.projects {
        Uuid::parse_str(&p.sentry_key).map_err(|e| {
            format!(
                "project '{}': sentry_key '{}' is not a valid UUID: {}",
                p.name, p.sentry_key, e
            )
        })?;
    }
    for t in &seeds.tokens {
        validate_token_format(&t.token)?;
    }

    // Connect (reuses Config::from_env so DATABASE_URL handling is consistent)
    let config = Config::from_env().map_err(|e| format!("Configuration error: {}", e))?;
    let pool = db::create_pool(&config.database)
        .await
        .map_err(|e| format!("Failed to connect to DB: {}", e))?;

    // We do NOT run migrations ourselves — the server runs them on startup.
    // Instead, we poll for the schema to be ready so we don't race against
    // the server. This makes the compose ordering robust: `depends_on:
    // server: condition: service_started` is enough.
    wait_for_schema(&pool).await?;

    let mut summary = Summary::default();

    for u in &seeds.users {
        match seed_user(&pool, u).await? {
            SeedOutcome::Created => summary.users_created += 1,
            SeedOutcome::AlreadyExists => summary.users_skipped += 1,
        }
    }

    for p in &seeds.projects {
        match seed_project(&pool, p).await? {
            SeedOutcome::Created => summary.projects_created += 1,
            SeedOutcome::AlreadyExists => summary.projects_skipped += 1,
        }
    }

    for t in &seeds.tokens {
        match seed_token(&pool, t).await? {
            SeedOutcome::Created => summary.tokens_created += 1,
            SeedOutcome::AlreadyExists => summary.tokens_skipped += 1,
        }
    }

    summary.print();

    // Print DSNs for all seeded projects (whether newly created or pre-existing)
    let base_url = format!("http://{}:{}", public_host(&config), config.port);
    print_dsns(&pool, &seeds.projects, &base_url).await?;

    Ok(())
}

#[derive(Default)]
struct Summary {
    users_created: usize,
    users_skipped: usize,
    projects_created: usize,
    projects_skipped: usize,
    tokens_created: usize,
    tokens_skipped: usize,
}

impl Summary {
    fn print(&self) {
        println!();
        println!("==============================================");
        println!("Seed summary");
        println!("  users:    {} created, {} skipped", self.users_created, self.users_skipped);
        println!("  projects: {} created, {} skipped", self.projects_created, self.projects_skipped);
        println!("  tokens:   {} created, {} skipped", self.tokens_created, self.tokens_skipped);
        println!("==============================================");
        println!();
    }
}

#[derive(Debug, Clone, Copy)]
enum SeedOutcome {
    Created,
    AlreadyExists,
}

// -----------------------------------------------------------------------------
// Users
// -----------------------------------------------------------------------------

async fn seed_user(pool: &DbPool, u: &UserSeed) -> AppResult<SeedOutcome> {
    if UsersService::get_by_email(pool, &u.email).await?.is_some() {
        log::info!("user {} already exists, skipping", u.email);
        return Ok(SeedOutcome::AlreadyExists);
    }

    let req = CreateUserRequest {
        email: u.email.clone(),
        password: u.password.clone(),
    };
    UsersService::create_user(pool, &req, u.is_admin).await?;
    log::info!(
        "✅ created user {} ({}admin)",
        u.email,
        if u.is_admin { "" } else { "non-" }
    );
    Ok(SeedOutcome::Created)
}

// -----------------------------------------------------------------------------
// Projects (deterministic sentry_key)
// -----------------------------------------------------------------------------
//
// We bypass `ProjectService::create` because that service generates a random
// `sentry_key`. For seeding we want a *fixed* UUID so the DSN is stable and
// reproducible across `docker-compose up` cycles.

async fn seed_project(pool: &DbPool, p: &ProjectSeed) -> AppResult<SeedOutcome> {
    let sentry_key = Uuid::parse_str(&p.sentry_key).expect("validated up-front");

    // Idempotency: if a row already exists with this name OR slug OR sentry_key,
    // we treat it as "already seeded" and move on. We don't try to repair
    // mismatches between fields — if a user has fiddled with the row manually,
    // they own that conflict.
    let existing: Option<i32> = sqlx::query_scalar(
        r#"
        SELECT id FROM projects
        WHERE name = $1 OR slug = $2 OR sentry_key = $3
        LIMIT 1
        "#,
    )
    .bind(&p.name)
    .bind(&p.slug)
    .bind(sentry_key)
    .fetch_optional(pool)
    .await?;

    if existing.is_some() {
        log::info!("project '{}' already exists, skipping", p.name);
        return Ok(SeedOutcome::AlreadyExists);
    }

    sqlx::query(
        r#"
        INSERT INTO projects (name, slug, sentry_key)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(&p.name)
    .bind(&p.slug)
    .bind(sentry_key)
    .execute(pool)
    .await?;

    log::info!(
        "✅ created project '{}' (slug={}, sentry_key={})",
        p.name,
        p.slug,
        sentry_key
    );
    Ok(SeedOutcome::Created)
}

// -----------------------------------------------------------------------------
// Auth tokens (deterministic value)
// -----------------------------------------------------------------------------
//
// Same reasoning as projects: `AuthTokenService::create` generates a random
// 40-char hex token. For seeded SDK use we want a known value so the DSN
// configuration is stable.

async fn seed_token(pool: &DbPool, t: &TokenSeed) -> AppResult<SeedOutcome> {
    let existing: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM auth_tokens WHERE token = $1 LIMIT 1",
    )
    .bind(&t.token)
    .fetch_optional(pool)
    .await?;

    if existing.is_some() {
        log::info!("token {}... already exists, skipping", &t.token[..8]);
        return Ok(SeedOutcome::AlreadyExists);
    }

    sqlx::query(
        r#"
        INSERT INTO auth_tokens (token, description)
        VALUES ($1, $2)
        "#,
    )
    .bind(&t.token)
    .bind(&t.description)
    .execute(pool)
    .await?;

    log::info!(
        "✅ created token {}... ({})",
        &t.token[..8],
        t.description.as_deref().unwrap_or("no description")
    );
    Ok(SeedOutcome::Created)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/// Block until the server-managed migrations have run.
///
/// We probe the `projects` table because it's part of the initial schema
/// migration. Times out after ~60s.
async fn wait_for_schema(pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    use std::time::Duration;
    use tokio::time::sleep;

    let max_attempts = 60;
    for attempt in 1..=max_attempts {
        match sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM projects")
            .fetch_one(pool)
            .await
        {
            Ok(_) => {
                if attempt > 1 {
                    log::info!("schema ready after {} attempt(s)", attempt);
                }
                return Ok(());
            }
            Err(e) => {
                if attempt == max_attempts {
                    return Err(format!(
                        "timed out waiting for migrations after {}s: {}",
                        max_attempts, e
                    )
                    .into());
                }
                log::info!(
                    "waiting for migrations (attempt {}/{})...",
                    attempt,
                    max_attempts
                );
                sleep(Duration::from_secs(1)).await;
            }
        }
    }
    unreachable!()
}

fn validate_token_format(token: &str) -> Result<(), String> {
    if token.len() != 40 {
        return Err(format!(
            "token must be exactly 40 characters (got {}): {}",
            token.len(),
            token
        ));
    }
    if !token.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()) {
        return Err(format!(
            "token must be 40 lowercase hex chars: {}",
            token
        ));
    }
    Ok(())
}

/// Determine a useful host for printing DSNs. Inside a container `0.0.0.0` is
/// not a routable address, so we fall back to the `RUSTRAK_PUBLIC_HOST` override
/// (typically set to `localhost` for local dev) when `HOST` is `0.0.0.0`.
fn public_host(config: &Config) -> String {
    if let Ok(host) = env::var("RUSTRAK_PUBLIC_HOST") {
        if !host.is_empty() {
            return host;
        }
    }
    if config.host == "0.0.0.0" || config.host == "::" {
        "localhost".to_string()
    } else {
        config.host.clone()
    }
}

async fn print_dsns(
    pool: &DbPool,
    projects: &[ProjectSeed],
    base_url: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if projects.is_empty() {
        return Ok(());
    }

    println!("DSNs (use these in your Sentry SDK config):");
    for p in projects {
        let sentry_key = Uuid::parse_str(&p.sentry_key).expect("validated up-front");
        let row: Option<i32> =
            sqlx::query_scalar("SELECT id FROM projects WHERE sentry_key = $1")
                .bind(sentry_key)
                .fetch_optional(pool)
                .await?;
        let Some(id) = row else {
            log::warn!("project '{}' missing after seed (race?); skipping DSN", p.name);
            continue;
        };
        let host = base_url
            .trim_start_matches("http://")
            .trim_start_matches("https://");
        let scheme = if base_url.starts_with("https") { "https" } else { "http" };
        let key = sentry_key.simple();
        println!("  {} → {}://{}@{}/{}", p.name, scheme, key, host, id);
    }
    println!();
    Ok(())
}
