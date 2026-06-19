use actix_web::{web, HttpRequest, HttpResponse};
use bytes::Bytes;
use chrono::Utc;

use crate::auth::SentryAuth;
use crate::config::Config;
use crate::db::DbPool;
use crate::digest::processors::{Processor, ProcessorCtx, Processors, SessionItem};
use crate::error::{AppError, AppResult};
use crate::ingest::{
    decompress_body, get_content_encoding, get_ingest_dir, store_event, EnvelopeItemKind,
    EnvelopeParser, EventMetadata, MAX_COMPRESSED_SIZE,
};
use crate::services::RateLimitService;

/// Response for successful ingestion.
/// `id` is absent for session-only envelopes, mirroring Relay's StoreResponse.
#[derive(serde::Serialize)]
pub struct IngestResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

/// POST /api/{project_id}/envelope/
/// Main ingestion endpoint compatible with Sentry SDK
pub async fn ingest_envelope(
    pool: web::Data<DbPool>,
    config: web::Data<Config>,
    req: HttpRequest,
    auth: SentryAuth,
    body: Bytes,
    processors: web::Data<Processors>,
) -> AppResult<HttpResponse> {
    // 0. Check rate limits (fail fast before processing)
    if let Some(exceeded) = RateLimitService::check_quota(pool.get_ref(), &auth.project).await? {
        log::warn!(
            "Rate limit exceeded for project {}: retry_after={}s",
            auth.project.id,
            exceeded.retry_after
        );
        return Ok(HttpResponse::TooManyRequests()
            .insert_header(("Retry-After", exceeded.retry_after.to_string()))
            .json(serde_json::json!({
                "error": "rate_limit_exceeded",
                "retry_after": exceeded.retry_after
            })));
    }

    let ingested_at = Utc::now();
    let ingest_dir = get_ingest_dir(config.ingest_dir.as_deref());

    // 1. Get client IP
    let remote_addr = req
        .connection_info()
        .realip_remote_addr()
        .map(|s| s.to_string());

    // 2. Decompress if needed
    let content_encoding = get_content_encoding(&req);
    let decompressed = decompress_body(body, content_encoding.as_deref())?;

    // 3. Parse envelope
    let mut parser = EnvelopeParser::new(&decompressed);
    let envelope = parser.parse()?;

    // 4. Typed dispatch — exhaustive, compiler-verified.
    //    event_id validation is deferred until after the loop — session-only envelopes never need
    //    one (Relay: Item::requires_event() returns false for Session/Sessions).
    let mut event_item: Option<Vec<u8>> = None;
    let mut transaction_item: Option<Vec<u8>> = None;
    let mut requires_event_id = false;
    for item_kind in envelope.items {
        if item_kind.requires_event() {
            requires_event_id = true;
        }
        match item_kind {
            EnvelopeItemKind::Event(p) => {
                if event_item.is_none() {
                    event_item = Some(p);
                }
            }
            EnvelopeItemKind::Transaction(p) => {
                if transaction_item.is_none() {
                    transaction_item = Some(p);
                }
            }
            EnvelopeItemKind::Session(s) => {
                let ctx = session_ctx(&pool, auth.project.id, ingested_at, &remote_addr);
                if let Err(e) = processors
                    .sessions
                    .process(SessionItem::Update(s), &ctx)
                    .await
                {
                    log::warn!("session item processing failed: {:?}", e);
                }
            }
            EnvelopeItemKind::Sessions(s) => {
                let ctx = session_ctx(&pool, auth.project.id, ingested_at, &remote_addr);
                if let Err(e) = processors
                    .sessions
                    .process(SessionItem::Aggregates(s), &ctx)
                    .await
                {
                    log::warn!("sessions item processing failed: {:?}", e);
                }
            }
            EnvelopeItemKind::Other(t, _) => {
                log::debug!("envelope item '{}' ignored", t);
            }
        }
    }

    // 5. Resolve event_id — only required when there is an event item.
    //    If the SDK omitted it, auto-generate (mirrors Relay's get_or_insert_with(EventId::new)).
    //    For session-only envelopes, pass through whatever the SDK provided (may be None).
    let event_id: Option<String> = if requires_event_id {
        let id = envelope
            .headers
            .event_id
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string().replace("-", ""));
        uuid::Uuid::parse_str(&id)
            .map_err(|_| AppError::Validation("event_id must be a valid UUID".to_string()))?;
        Some(id)
    } else {
        envelope.headers.event_id.clone()
    };

    // 6. Spawn transaction processing (direct, bypasses filesystem and digest worker).
    //    Must happen BEFORE the early-return so transaction-only envelopes are stored.
    if let Some(txn_payload) = transaction_item {
        let processors = processors.clone();
        let pool_clone = pool.get_ref().clone();
        let event_id_txn = event_id
            .clone()
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string().replace("-", ""));
        let project_id = auth.project.id;
        let ingested = ingested_at;
        let remote = remote_addr.clone();
        tokio::spawn(async move {
            let parsed_id =
                uuid::Uuid::parse_str(&event_id_txn).unwrap_or_else(|_| uuid::Uuid::new_v4());
            let ctx = ProcessorCtx {
                pool: pool_clone,
                project_id,
                event_id: parsed_id,
                ingested_at: ingested,
                remote_addr: remote,
            };
            if let Err(e) = processors.transactions.process(txn_payload, &ctx).await {
                log::error!("Failed to store transaction {}: {:?}", event_id_txn, e);
            }
        });
    }

    // 7. Early return for session-only (and other non-event) envelopes.
    let event_item = match event_item {
        Some(item) => item,
        None => {
            log::debug!("No event item in envelope");
            return Ok(HttpResponse::Ok().json(IngestResponse { id: event_id }));
        }
    };

    // event_id is guaranteed Some from this point: event_item.is_some() was true above.
    let event_id = event_id.expect("event_id is Some when event_item is Some");

    // 6. Validate that payload is valid JSON
    let _: serde_json::Value = serde_json::from_slice(&event_item)
        .map_err(|e| AppError::Validation(format!("Invalid event JSON: {}", e)))?;

    // 7. Store event in filesystem
    store_event(&ingest_dir, &event_id, &event_item).await?;

    // 8. Create metadata
    let metadata = EventMetadata {
        event_id: event_id.clone(),
        project_id: auth.project.id,
        ingested_at,
        remote_addr,
    };

    // 9. Spawn digest task — the ErrorProcessor reads the temp file and runs
    //    grouping/issue creation. It owns ingest_dir/rate_limit/sourcemap deps.
    let processors = processors.clone();
    let pool_clone = pool.get_ref().clone();
    tokio::spawn(async move {
        let event_id_log = metadata.event_id.clone();
        let ctx = ProcessorCtx {
            pool: pool_clone,
            project_id: metadata.project_id,
            event_id: uuid::Uuid::parse_str(&metadata.event_id)
                .unwrap_or_else(|_| uuid::Uuid::nil()),
            ingested_at: metadata.ingested_at,
            remote_addr: metadata.remote_addr.clone(),
        };
        if let Err(e) = processors.errors.process(metadata, &ctx).await {
            log::error!("Failed to digest event {}: {:?}", event_id_log, e);
        }
    });

    // 10. Return immediately (CORS handled by middleware)
    Ok(HttpResponse::Ok().json(IngestResponse { id: Some(event_id) }))
}

/// Builds a [`ProcessorCtx`] for session items, which carry no event id.
fn session_ctx(
    pool: &web::Data<DbPool>,
    project_id: i32,
    ingested_at: chrono::DateTime<Utc>,
    remote_addr: &Option<String>,
) -> ProcessorCtx {
    ProcessorCtx {
        pool: pool.get_ref().clone(),
        project_id,
        event_id: uuid::Uuid::nil(),
        ingested_at,
        remote_addr: remote_addr.clone(),
    }
}

/// POST /api/{project_id}/store/
/// Legacy endpoint (deprecated)
pub async fn ingest_store(
    _pool: web::Data<DbPool>,
    _config: web::Data<Config>,
    _req: HttpRequest,
    _auth: SentryAuth,
    _body: Bytes,
) -> AppResult<HttpResponse> {
    Err(AppError::Validation(
        "The /store/ endpoint is deprecated. Please use /envelope/ instead.".to_string(),
    ))
}

/// OPTIONS for CORS preflight (handled by middleware, but kept for explicit routing)
pub async fn options() -> HttpResponse {
    HttpResponse::Ok().finish()
}

/// Configures the ingest routes
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/{project_id}")
            .app_data(web::PayloadConfig::new(MAX_COMPRESSED_SIZE))
            .route("/envelope/", web::post().to(ingest_envelope))
            .route(
                "/envelope/",
                web::method(actix_web::http::Method::OPTIONS).to(options),
            )
            .route("/store/", web::post().to(ingest_store))
            .route(
                "/store/",
                web::method(actix_web::http::Method::OPTIONS).to(options),
            ),
    );
}
