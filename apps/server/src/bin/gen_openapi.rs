use utoipa::OpenApi;

fn main() {
    let spec = rustrak::openapi::ApiDoc::openapi()
        .to_pretty_json()
        .expect("failed to serialize openapi spec");

    let path = format!("{}/openapi.json", env!("CARGO_MANIFEST_DIR"));
    std::fs::write(&path, spec).unwrap_or_else(|e| {
        eprintln!("error: failed to write {path}: {e}");
        std::process::exit(1);
    });

    println!("wrote {path}");
}
