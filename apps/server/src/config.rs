use actix_web::cookie::Key;
use std::env;
use std::time::Duration;

/// Application configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database: DatabaseConfig,
    pub rate_limit: RateLimitConfig,
    pub security: SecurityConfig,
    pub ingest_dir: Option<String>,
    /// Optional public-facing URL used to build DSN strings shown to users.
    /// Must include scheme (http:// or https://). Trailing slash is stripped at load time.
    /// Falls back to `http://{HOST}:{PORT}` when unset.
    pub public_url: Option<String>,
    /// Directory where assembled source map files are stored on disk (CAS layout).
    /// Default: /data/sourcemaps. Override with SOURCEMAP_STORAGE_PATH env var.
    pub sourcemap_storage_path: String,
    /// Maximum allowed size of a single uploaded chunk in bytes.
    /// Default: 10 MB. Override with MAX_CHUNK_SIZE_BYTES env var.
    pub max_chunk_size_bytes: usize,
    /// How often the session aggregator flushes in-memory buckets to the DB (seconds).
    /// Default: 30. Override with SESSION_FLUSH_INTERVAL_SECS env var.
    pub session_flush_interval_secs: u64,
    /// Max distinct (release, environment) pairs tracked per project before folding into <overflow>.
    /// Default: 10000. Override with SESSION_CARDINALITY_CAP env var.
    pub session_cardinality_cap: usize,
}

/// Database connection pool configuration
#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub acquire_timeout: Duration,
    pub idle_timeout: Duration,
    pub max_lifetime: Duration,
}

/// Security configuration for production deployments
#[derive(Clone)]
pub struct SecurityConfig {
    /// True if server is behind a proxy that terminates SSL (nginx, Cloudflare, etc.)
    /// When true: cookie_secure=true is enabled
    pub ssl_proxy: bool,
    /// Session encryption key (64 hex chars). Required when ssl_proxy=true
    pub session_secret_key: Option<String>,
}

impl std::fmt::Debug for SecurityConfig {
    /// Hand-written so the secret cannot reach a log line through the derived
    /// `Debug` on `Config`.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SecurityConfig")
            .field("ssl_proxy", &self.ssl_proxy)
            .field(
                "session_secret_key",
                &self.session_secret_key.as_ref().map(|_| "[redacted]"),
            )
            .finish()
    }
}

/// Rate limiting configuration
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Global (installation-wide) max events per minute
    pub max_events_per_minute: i64,
    /// Global (installation-wide) max events per hour
    pub max_events_per_hour: i64,
    /// Per-project max events per minute
    pub max_events_per_project_per_minute: i64,
    /// Per-project max events per hour
    pub max_events_per_project_per_hour: i64,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(Self {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .map_err(|_| ConfigError::InvalidPort)?,
            database: DatabaseConfig::from_env()?,
            rate_limit: RateLimitConfig::from_env(),
            security: SecurityConfig::from_env()?,
            ingest_dir: env::var("INGEST_DIR").ok(),
            sourcemap_storage_path: env::var("SOURCEMAP_STORAGE_PATH")
                .unwrap_or_else(|_| "/data/sourcemaps".to_string()),
            max_chunk_size_bytes: env::var("MAX_CHUNK_SIZE_BYTES")
                .unwrap_or_else(|_| (10 * 1024 * 1024).to_string())
                .parse()
                .unwrap_or(10 * 1024 * 1024),
            public_url: env::var("PUBLIC_URL")
                .ok()
                .filter(|s| !s.trim().is_empty())
                .map(|s| {
                    let trimmed = s.trim().trim_end_matches('/');
                    // Normalize scheme to lowercase (RFC 3986: scheme is case-insensitive)
                    if let Some(pos) = trimmed.find("://") {
                        format!("{}{}", trimmed[..pos].to_lowercase(), &trimmed[pos..])
                    } else {
                        trimmed.to_string()
                    }
                }),
            session_flush_interval_secs: env::var("SESSION_FLUSH_INTERVAL_SECS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),
            session_cardinality_cap: env::var("SESSION_CARDINALITY_CAP")
                .unwrap_or_else(|_| "10000".to_string())
                .parse()
                .unwrap_or(10_000),
        })
    }
}

impl RateLimitConfig {
    /// Load rate limit configuration from environment variables
    pub fn from_env() -> Self {
        Self {
            max_events_per_minute: env::var("MAX_EVENTS_PER_MINUTE")
                .unwrap_or_else(|_| "1000".to_string())
                .parse()
                .unwrap_or(1000),
            max_events_per_hour: env::var("MAX_EVENTS_PER_HOUR")
                .unwrap_or_else(|_| "10000".to_string())
                .parse()
                .unwrap_or(10000),
            max_events_per_project_per_minute: env::var("MAX_EVENTS_PER_PROJECT_PER_MINUTE")
                .unwrap_or_else(|_| "500".to_string())
                .parse()
                .unwrap_or(500),
            max_events_per_project_per_hour: env::var("MAX_EVENTS_PER_PROJECT_PER_HOUR")
                .unwrap_or_else(|_| "5000".to_string())
                .parse()
                .unwrap_or(5000),
        }
    }
}

impl DatabaseConfig {
    /// Load database configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        #[cfg(feature = "sqlite")]
        let url =
            env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:///data/rustrak.db".to_string());
        #[cfg(not(feature = "sqlite"))]
        let url = env::var("DATABASE_URL").map_err(|_| ConfigError::MissingDatabaseUrl)?;

        Ok(Self {
            url,
            max_connections: env::var("DATABASE_MAX_CONNECTIONS")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10),
            min_connections: env::var("DATABASE_MIN_CONNECTIONS")
                .unwrap_or_else(|_| "1".to_string())
                .parse()
                .unwrap_or(1),
            acquire_timeout: Duration::from_secs(
                env::var("DATABASE_ACQUIRE_TIMEOUT_SECS")
                    .unwrap_or_else(|_| "5".to_string())
                    .parse()
                    .unwrap_or(5),
            ),
            idle_timeout: Duration::from_secs(
                env::var("DATABASE_IDLE_TIMEOUT_SECS")
                    .unwrap_or_else(|_| "600".to_string())
                    .parse()
                    .unwrap_or(600),
            ),
            max_lifetime: Duration::from_secs(
                env::var("DATABASE_MAX_LIFETIME_SECS")
                    .unwrap_or_else(|_| "1800".to_string())
                    .parse()
                    .unwrap_or(1800),
            ),
        })
    }
}

#[derive(Debug)]
pub enum ConfigError {
    InvalidPort,
    MissingDatabaseUrl,
    MissingSessionSecret,
    SessionSecretTooShort { len: usize },
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::InvalidPort => write!(f, "PORT must be a valid number"),
            ConfigError::MissingDatabaseUrl => {
                write!(f, "DATABASE_URL environment variable is required")
            }
            ConfigError::MissingSessionSecret => {
                write!(
                    f,
                    "SESSION_SECRET_KEY is required when SSL_PROXY is enabled"
                )
            }
            ConfigError::SessionSecretTooShort { len } => {
                write!(
                    f,
                    "SESSION_SECRET_KEY is {len} bytes, but at least {min} are required. \
                     Generate one with: openssl rand -hex 32",
                    min = SecurityConfig::MIN_SECRET_LEN
                )
            }
        }
    }
}

impl std::error::Error for ConfigError {}

impl SecurityConfig {
    /// Required length of `SESSION_SECRET_KEY`, in bytes: the cookie master key
    /// is a 256-bit signing key followed by a 256-bit encryption key.
    pub const MIN_SECRET_LEN: usize = 64;

    /// Load security configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        let session_secret_key = env::var("SESSION_SECRET_KEY").ok();

        let ssl_proxy = env::var("SSL_PROXY")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);

        // When SSL_PROXY is enabled, SESSION_SECRET_KEY is required
        if ssl_proxy && session_secret_key.is_none() {
            return Err(ConfigError::MissingSessionSecret);
        }

        // Build the key here so an unusable secret stops the process before it
        // opens the database, runs migrations and starts the workers.
        if let Some(secret) = &session_secret_key {
            Self::key_from_secret(secret)?;
        }

        Ok(Self {
            ssl_proxy,
            session_secret_key,
        })
    }

    /// Builds the master key used to sign and encrypt session cookies.
    pub fn session_key(&self) -> Result<Key, ConfigError> {
        match &self.session_secret_key {
            Some(secret) => Self::key_from_secret(secret),
            None => Ok(Key::generate()),
        }
    }

    fn key_from_secret(secret: &str) -> Result<Key, ConfigError> {
        let bytes = secret.as_bytes();

        if bytes.len() < Self::MIN_SECRET_LEN {
            return Err(ConfigError::SessionSecretTooShort { len: bytes.len() });
        }

        Ok(Key::from(bytes))
    }
}
