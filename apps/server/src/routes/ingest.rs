use actix_web::{web, HttpRequest, HttpResponse};
use bytes::Bytes;
use chrono::Utc;

use crate::auth::SentryAuth;
use crate::config::Config;
use crate::db::DbPool;
use crate::digest::processors::{
    is_retryable_write_contention, Processor, ProcessorCtx, Processors, SessionItem,
};
use crate::error::{AppError, AppResult};
use crate::ingest::{
    decompress_body, get_content_encoding, get_ingest_dir, list_pending_event_metadata,
    store_event_with_metadata, EnvelopeItemKind, EnvelopeParser, EventMetadata,
    MAX_COMPRESSED_SIZE,
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
    if let Some(exceeded) =
        RateLimitService::check_quota(pool.get_ref(), &auth.project, &config.rate_limit).await?
    {
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
    let mut span_items: Vec<Vec<u8>> = Vec::new();
    let mut span_v2_items: Vec<Vec<u8>> = Vec::new();
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
                let ctx = direct_store_ctx(&pool, auth.project.id, ingested_at, &remote_addr);
                processors
                    .sessions
                    .process(SessionItem::Update(s), &ctx)
                    .await?;
            }
            EnvelopeItemKind::Sessions(s) => {
                let ctx = direct_store_ctx(&pool, auth.project.id, ingested_at, &remote_addr);
                processors
                    .sessions
                    .process(SessionItem::Aggregates(s), &ctx)
                    .await?;
            }
            EnvelopeItemKind::Log(payload) => {
                // Logs are processed inline (parse container + store): the work is
                // bounded and storing before responding keeps the batch durable.
                let ctx = direct_store_ctx(&pool, auth.project.id, ingested_at, &remote_addr);
                processors.logs.process(payload, &ctx).await?;
            }
            EnvelopeItemKind::Span(payload) => {
                // Unlike Event/Transaction, an envelope may carry many standalone
                // span items (Relay: one flat span object per item, no per-envelope
                // count cap) — collect them all instead of first-wins.
                span_items.push(payload);
            }
            EnvelopeItemKind::SpanV2Batch(payload) => {
                // Each item is already a batch (one container can hold many
                // spans) — an envelope may still carry more than one such
                // container item, so collect them all.
                span_v2_items.push(payload);
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

    // Persist direct items before the early return; otherwise 200 could suppress
    // an SDK retry for data that was never stored.
    if let Some(txn_payload) = transaction_item {
        let event_id_txn = event_id
            .clone()
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string().replace("-", ""));
        let parsed_id =
            uuid::Uuid::parse_str(&event_id_txn).unwrap_or_else(|_| uuid::Uuid::new_v4());
        let ctx = ProcessorCtx {
            pool: pool.get_ref().clone(),
            project_id: auth.project.id,
            event_id: parsed_id,
            ingested_at,
            remote_addr: remote_addr.clone(),
        };
        processors.transactions.process(txn_payload, &ctx).await?;
    }

    // Persist standalone spans inline; they have no grouping or issue path.
    if !span_items.is_empty() {
        let ctx = ProcessorCtx {
            pool: pool.get_ref().clone(),
            project_id: auth.project.id,
            event_id: uuid::Uuid::nil(),
            ingested_at,
            remote_addr: remote_addr.clone(),
        };
        for span_payload in span_items {
            processors.spans.process(span_payload, &ctx).await?;
        }
    }

    // Persist v2 span batches inline for the same reason.
    if !span_v2_items.is_empty() {
        let ctx = ProcessorCtx {
            pool: pool.get_ref().clone(),
            project_id: auth.project.id,
            event_id: uuid::Uuid::nil(),
            ingested_at,
            remote_addr: remote_addr.clone(),
        };
        for batch_payload in span_v2_items {
            processors.spans_v2.process(batch_payload, &ctx).await?;
        }
    }

    // Return for session-only and other non-event envelopes.
    let event_item = match event_item {
        Some(item) => item,
        None => {
            log::debug!("No event item in envelope");
            return Ok(HttpResponse::Ok().json(IngestResponse { id: event_id }));
        }
    };

    let event_id = event_id.expect("event_id is Some when event_item is Some");

    let _: serde_json::Value = serde_json::from_slice(&event_item)
        .map_err(|e| AppError::Validation(format!("Invalid event JSON: {}", e)))?;

    // Store metadata beside the raw event so a failed digest can be recovered.
    let metadata = EventMetadata {
        event_id: event_id.clone(),
        project_id: auth.project.id,
        ingested_at,
        remote_addr,
    };
    store_event_with_metadata(&ingest_dir, &event_id, &event_item, &metadata).await?;

    // The digest worker owns grouping, issue creation, and its durable retry path.
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
        for attempt in 0..4 {
            match processors.errors.process(metadata.clone(), &ctx).await {
                Ok(()) => break,
                Err(e) if is_retryable_write_contention(&e) && attempt < 3 => {
                    let delay = std::time::Duration::from_millis(250 << attempt);
                    log::warn!(
                        "Digest {} remains locked; retrying after {:?}: {:?}",
                        event_id_log,
                        delay,
                        e
                    );
                    tokio::time::sleep(delay).await;
                }
                Err(e) => {
                    log::error!(
                        "Failed to digest event {}; it remains queued: {:?}",
                        event_id_log,
                        e
                    );
                    break;
                }
            }
        }
    });

    Ok(HttpResponse::Ok().json(IngestResponse { id: Some(event_id) }))
}

/// Replays event files left by a previous process after a digest failure.
pub async fn recover_pending_events(
    pool: DbPool,
    processors: web::Data<Processors>,
    ingest_dir: std::path::PathBuf,
) {
    const RECOVERY_INTERVAL: std::time::Duration = std::time::Duration::from_secs(30);

    loop {
        recover_pending_events_once(pool.clone(), processors.clone(), ingest_dir.clone()).await;
        tokio::time::sleep(RECOVERY_INTERVAL).await;
    }
}

/// Performs one bounded recovery scan.
pub async fn recover_pending_events_once(
    pool: DbPool,
    processors: web::Data<Processors>,
    ingest_dir: std::path::PathBuf,
) {
    let pending = match list_pending_event_metadata(&ingest_dir).await {
        Ok(pending) => pending,
        Err(e) => {
            log::error!("Failed to scan pending event metadata: {:?}", e);
            return;
        }
    };

    for metadata in pending {
        let event_id = metadata.event_id.clone();
        let ctx = ProcessorCtx {
            pool: pool.clone(),
            project_id: metadata.project_id,
            event_id: uuid::Uuid::parse_str(&metadata.event_id)
                .unwrap_or_else(|_| uuid::Uuid::nil()),
            ingested_at: metadata.ingested_at,
            remote_addr: metadata.remote_addr.clone(),
        };
        if let Err(e) = processors.errors.process(metadata, &ctx).await {
            log::warn!("Pending digest {} remains queued: {:?}", event_id, e);
        }
    }
}

/// Builds a [`ProcessorCtx`] for session items, which carry no event id.
fn direct_store_ctx(
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
