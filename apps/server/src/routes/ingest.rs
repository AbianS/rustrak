use actix_web::{web, HttpRequest, HttpResponse};
use bytes::Bytes;
use chrono::Utc;
use std::sync::Arc;

use crate::auth::SentryAuth;
use crate::config::Config;
use crate::db::DbPool;
use crate::digest;
use crate::error::{AppError, AppResult};
use crate::ingest::{
    decompress_body, get_content_encoding, get_ingest_dir, store_event, EnvelopeParser,
    EventMetadata, MAX_COMPRESSED_SIZE,
};
use crate::models::session::{SessionAggregates, SessionUpdate};
use crate::services::sourcemap::SourceMapProvider;
use crate::services::RateLimitService;
use crate::workers::session_aggregator::SessionAggregatorHandle;

/// Response for successful ingestion.
/// `id` is absent for session-only envelopes, mirroring Relay's StoreResponse.
#[derive(serde::Serialize)]
pub struct IngestResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

/// Returns true for item types that require an associated event_id.
/// Mirrors Relay's `Item::requires_event()` in relay-server/src/envelope/item.rs.
fn item_requires_event(item_type: &str) -> bool {
    matches!(
        item_type,
        "event" | "transaction" | "attachment" | "security"
    )
}

/// POST /api/{project_id}/envelope/
/// Main ingestion endpoint compatible with Sentry SDK
pub async fn ingest_envelope(
    pool: web::Data<DbPool>,
    config: web::Data<Config>,
    req: HttpRequest,
    auth: SentryAuth,
    body: Bytes,
    sourcemap_provider: web::Data<Arc<dyn SourceMapProvider>>,
    session_aggregator: Option<web::Data<SessionAggregatorHandle>>,
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

    // 4. Partition items: sessions go to the aggregator, event items are retained for digestion.
    //    event_id validation is deferred until after the loop — session-only envelopes never need
    //    one (Relay: Item::requires_event() returns false for Session/Sessions).
    let mut event_item = None;
    for item in envelope.items {
        match item.headers.item_type.as_str() {
            "session" => {
                if let Some(ref agg) = session_aggregator {
                    match serde_json::from_slice::<SessionUpdate>(&item.payload) {
                        Ok(update) => {
                            agg.ingest_session(auth.project.id, &update).await;
                        }
                        Err(e) => {
                            log::warn!("session item: invalid JSON, dropping: {}", e);
                        }
                    }
                }
            }
            "sessions" => {
                if let Some(ref agg) = session_aggregator {
                    match serde_json::from_slice::<SessionAggregates>(&item.payload) {
                        Ok(agg_payload) => {
                            agg.ingest_aggregates(auth.project.id, &agg_payload).await;
                        }
                        Err(e) => {
                            log::warn!("sessions item: invalid JSON, dropping: {}", e);
                        }
                    }
                }
            }
            t if item_requires_event(t) => {
                if event_item.is_none() {
                    event_item = Some(item);
                }
            }
            other => {
                log::debug!("envelope item type '{}' ignored", other);
            }
        }
    }

    // 5. Resolve event_id — only required when there is an event item.
    //    If the SDK omitted it, auto-generate (mirrors Relay's get_or_insert_with(EventId::new)).
    //    For session-only envelopes, pass through whatever the SDK provided (may be None).
    let event_id: Option<String> = if event_item.is_some() {
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

    // 6. Early return for session-only (and other non-event) envelopes.
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
    let _: serde_json::Value = serde_json::from_slice(&event_item.payload)
        .map_err(|e| AppError::Validation(format!("Invalid event JSON: {}", e)))?;

    // 7. Store event in filesystem
    store_event(&ingest_dir, &event_id, &event_item.payload).await?;

    // 8. Create metadata
    let metadata = EventMetadata {
        event_id: event_id.clone(),
        project_id: auth.project.id,
        ingested_at,
        remote_addr,
    };

    // 9. Spawn digest task
    let pool_clone = pool.get_ref().clone();
    let ingest_dir_clone = ingest_dir.clone();
    let rate_limit_config = config.rate_limit.clone();
    let provider_clone = Arc::clone(sourcemap_provider.get_ref());
    tokio::spawn(async move {
        if let Err(e) = digest::process_event(
            &pool_clone,
            &metadata,
            &ingest_dir_clone,
            &rate_limit_config,
            provider_clone,
        )
        .await
        {
            log::error!("Failed to digest event {}: {:?}", metadata.event_id, e);
        }
    });

    // 10. Return immediately (CORS handled by middleware)
    Ok(HttpResponse::Ok().json(IngestResponse { id: Some(event_id) }))
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
