//! Serving the built dashboard from inside the binary.
//!
//! The whole point: `rustrak` becomes one artifact. No Node process, no second
//! container, no `RUSTRAK_API_URL` to configure. The browser talks to the same
//! origin that served it, so the session cookie works with no CORS involved.
//!
//! The assets are **embedded**, not read from disk. Serving them from a
//! directory is the other common answer (Qdrant does it) and it creates a whole
//! class of deployment bug: the binary starts fine and every page is a 404
//! because the folder was not copied. Embedding makes that unrepresentable.
//!
//! Compiled only with the `dashboard` feature. Without it this module does not
//! exist, `rust-embed` is not a dependency, and `apps/dashboard/dist` does not
//! need to exist to build the server.

use actix_web::body::BoxBody;
use actix_web::http::header::{HeaderValue, CACHE_CONTROL, CONTENT_TYPE, ETAG, IF_NONE_MATCH};
use actix_web::{HttpRequest, HttpResponse};
use rust_embed::RustEmbed;

/// The output of `pnpm --filter=dashboard build`.
///
/// The path is resolved at compile time relative to this crate's manifest. The
/// build order is guaranteed by turbo, not by cargo: `@rustrak/server` depends
/// on `dashboard`, so `dist/` exists before `cargo build` runs. If it does not,
/// compilation fails here and says so, which is the right failure.
#[derive(RustEmbed)]
#[folder = "../dashboard/dist"]
struct Assets;

/// The SPA shell. Every route the client owns is served from this one file.
const SHELL: &str = "index.html";

/// Whether the dashboard should be served at all.
///
/// Compiled in and still switchable at run time, because those are different
/// questions: a distribution decides what to ship, an operator decides what to
/// expose. Someone fronting Rustrak with their own UI wants the API alone
/// without rebuilding from source.
pub fn is_enabled() -> bool {
    !matches!(
        std::env::var("RUSTRAK_DASHBOARD").as_deref(),
        Ok("off" | "false" | "0")
    )
}

/// Serve an embedded asset, falling back to the SPA shell.
///
/// Registered as the app's `default_service`, so it only ever sees requests no
/// API route matched. That is what makes mounting at `/` safe: `/api/*`,
/// `/auth/*` and `/health*` are claimed before this runs.
pub async fn serve(req: HttpRequest) -> HttpResponse {
    let path = req.path().trim_start_matches('/');
    let path = if path.is_empty() { SHELL } else { path };

    match Assets::get(path) {
        Some(asset) => respond(&req, path, asset),
        // Deep links are the reason this fallback exists: a reload on
        // `/issues` has to return the shell so the router can take over.
        //
        // But only for paths that do not look like a file. A missing
        // `/assets/index-abc123.js` must stay a 404: answering it with HTML
        // gets swallowed by the browser as a MIME type error, which is a
        // genuinely awful thing to debug. A 404 says what actually happened.
        None if !looks_like_a_file(path) => match Assets::get(SHELL) {
            Some(shell) => respond(&req, SHELL, shell),
            None => HttpResponse::NotFound().finish(),
        },
        None => HttpResponse::NotFound().finish(),
    }
}

/// A path segment with an extension is asking for a file, not for a route.
fn looks_like_a_file(path: &str) -> bool {
    path.rsplit('/')
        .next()
        .is_some_and(|last| last.contains('.'))
}

fn respond(req: &HttpRequest, path: &str, asset: rust_embed::EmbeddedFile) -> HttpResponse {
    let etag = format!("\"{}\"", hex::encode(asset.metadata.sha256_hash()));

    // The hash is the content, so a match means the client already has this
    // exact byte sequence. Cheap, and it makes a reload free.
    if req
        .headers()
        .get(IF_NONE_MATCH)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value == etag)
    {
        return HttpResponse::NotModified().finish();
    }

    let mime = mime_guess::from_path(path).first_or_octet_stream();

    // Vite fingerprints everything under `assets/`, so those URLs can never
    // mean anything else and are safe to keep forever. The shell must never be
    // cached: it is the file that names the current fingerprints, and a stale
    // one points the browser at assets that no longer exist.
    let cache = if path.starts_with("assets/") {
        "public, max-age=31536000, immutable"
    } else {
        "no-cache"
    };

    let mut response = HttpResponse::Ok();
    response
        .insert_header((CONTENT_TYPE, mime.as_ref()))
        .insert_header((CACHE_CONTROL, HeaderValue::from_static(cache)));

    if let Ok(value) = HeaderValue::from_str(&etag) {
        response.insert_header((ETAG, value));
    }

    response.body(BoxBody::new(asset.data.into_owned()))
}
